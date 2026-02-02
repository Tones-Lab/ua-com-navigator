# FCOM Processor Reference (Cleaned)

Last reviewed: 2026-01-31

## Overview

The FCOM Processor microservice takes collected fault data from an input topic, normalizes it using FCOM (Fault Common Object Model) definitions into an event structure, and publishes the results to an output topic. The Event Sink microservice subscribes to the default output topic, but you can configure additional topics for enrichment or suppression.

This microservice is part of the Unified Assurance Event pipeline.

## Prerequisites

- Microservice cluster is deployed.
- Apache Pulsar is deployed.
- Coherence Operator and Coherence are deployed when using Coherence-based features.

## Deploying

### CLI

```bash
su - assure1
export NAMESPACE=<namespace>
export WEBFQDN=<WebFQDN>
a1helm install <microservice-release-name> assure1/fcom-processor \
  -n $NAMESPACE \
  --set global.imageRegistry=$WEBFQDN
```

- `<namespace>` is the target namespace (default is `a1-zone1-pri`).
- `<WebFQDN>` is the primary presentation server FQDN.
- `<microservice-release-name>` is typically `fcom-processor`.

### UI

You can also deploy via the Unified Assurance UI.

## Configuration

### Default configData parameters

| Name | Default | Supported values | Notes |
| --- | --- | --- | --- |
| `LOG_LEVEL` | `INFO` | `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG` | Logging level. |
| `STREAM_INPUT` | `persistent://assure1/event/collection` | Text | Pulsar input topic. |
| `STREAM_OUTPUT` | `persistent://assure1/event/sink` | Text | Pulsar output topic. |
| `FCOM_FILES_LOCATION` | `core/default/processing/event/fcom` | Text | SVN path for overrides/lookup/FCOM/Grok files. |
| `CACHE_TTL` | `3600000` | Integer | Cache TTL in ms (Coherence). |
| `CACHE_OUTPUT` | `coherence://coherence-cluster-extend.a1-cache:20000` | Text | Coherence cache URL. |

### Autoscaling

| Name | Default | Type | Notes |
| --- | --- | --- | --- |
| `thresholds.backlogSize` | `1000` | Integer | Backlog size before scaling. |
| `thresholds.totalEventsProcessed` | `6000` | Integer | Avg total events processed per 5 minutes. |

## Self-monitoring metrics

Metric names are inserted with a `prom_` prefix when stored in the database.

- `event_collection_backlog_size` (Gauge)
- `total_events_processed` (Counter)
- `processing_time_per_event` (Gauge)
- `total_events_discarded` (Counter)
- `number_of_errors_occurred` (Gauge)
- `number_of_syslog_messages` (Gauge)
- `number_of_vmware_messages` (Gauge)
- `number_of_rca_messages` (Gauge)
- `number_of_mist_rca_messages` (Gauge)
- `number_of_corba_messages` (Gauge)
- `number_of_trap_messages` (Gauge)

## Custom event rules (FCOM definitions)

Custom collectors/pollers must provide FCOM rules for custom event payloads.

Key requirements:

- Each `@objectName` must be unique across COM definition files.
- `method` must match the `_type` field from the event payload.
- `method` also serves as the key for payload field matching.

Minimal format:

```json
{
  "objects": [
    {
      "@objectName": "<unique_object_name>",
      "certification": "STANDARD",
      "description": [],
      "domain": "FAULT",
      "event": {
        "<event_initialization_fields>": "..."
      },
      "method": "<_type_field_from_payload>",
      "<_type_field_from_payload>": {
        "<field_or_path>": "<value>"
      },
      "subMethod": "event",
      "preProcessors": [],
      "postProcessors": []
    }
  ]
}
```

Example method matchers:

```json
{
  "method": "syslog",
  "syslog": {
    "messageID": "%LINK-5-CHANGED"
  }
}
```

```json
{
  "method": "webhook",
  "webhook": {
    "$.webhook.endpoint": "/webhook/aruba"
  }
}
```

## Overrides

Overrides are JSON files that add or replace processor behavior before or after conversion.

### Processing order (v2)

- Pre-conversion: Global → Object-specific
- Post-conversion: Object-specific → Global

### Version 3 overrides (v3)

- v3 overrides merge into COM definitions using JSON Patch operations.
- Pre-conversion conflicts: object-specific overrides win.
- Post-conversion conflicts: global overrides win.

### JSON paths available

- `$.lookups.{lookupName}.{key}`
- `$.foreach.{keyVal}` and `$.foreach.{valField}`
- `$.localmem.{name}`
- `$.globalmem.{name}` (requires Coherence)
- `$.error.message`
- `$.event.*` (post-conversion only; not available in pre scope)

### Override file format

| Name | Required | Supported values | Notes |
| --- | --- | --- | --- |
| `name` | Yes | Text | Override file name. |
| `description` | No | Text | Description. |
| `domain` | Yes | `fault` | Always `fault` for FCOM overrides. |
| `method` | Yes | `trap` or `syslog` | Message type. |
| `scope` | Yes | `pre` or `post` | When override runs. |
| `version` | No | `v2` or `v3` | Defaults to `v2`. |
| `@objectName` | Yes | `GLOBAL` or object name | Global or object-specific. |
| `_type` | Yes | `override` | File type. |
| `processors` | Yes | Array | v2: processors; v3: JSON Patch ops. |

Notes:

- Fields prefixed with `$.event` are only valid in `post` scope. In `pre` scope (global or object), `$.event.*` is not available.
- Use ECMASCRIPT6 (ES6) syntax for `eval` in trap rules.

### JSON Patch operations (v3)

- `add`, `remove`, `replace`, `move`, `copy`, `test`
- Paths follow JSON Pointer syntax (e.g. `"/0"`, `"/-"`).

### Example v2 override

```json
{
  "name": "Override Example",
  "description": "Example global override",
  "domain": "fault",
  "method": "trap",
  "scope": "post",
  "@objectName": "GLOBAL",
  "_type": "override",
  "processors": [
    {
      "set": {
        "source": "Hello, this is an example of overriding the event Summary field",
        "targetField": "$.event.Details"
      }
    }
  ]
}
```

### Example v3 override

```json
{
  "name": "Override Example",
  "description": "Example global override",
  "domain": "fault",
  "method": "trap",
  "scope": "post",
  "version": "v3",
  "@objectName": "GLOBAL",
  "_type": "override",
  "processors": [
    {
      "op": "add",
      "path": "/-",
      "value": {
        "set": {
          "source": "Hello, this is an example of overriding the event Summary field",
          "targetField": "$.event.Details"
        }
      }
    }
  ]
}
```

### Overriding `EventKey`

`EventKey` is typically composed from event fields. You can override it with a `set` processor in a post-conversion override.

```json
{
  "name": "EventKey Override",
  "description": "Global postprocessor v2 override",
  "domain": "fault",
  "method": "trap",
  "scope": "post",
  "@objectName": "GLOBAL",
  "_type": "override",
  "processors": [
    {
      "set": {
        "source": "%s+%s+%s+%s",
        "args": [
          "$.event.Node",
          "$.event.SubNode",
          "$.event.EventType",
          "$.event.EventCategory"
        ],
        "targetField": "$.event.EventKey"
      }
    }
  ]
}
```

## Processor reference (summary)

All processors support `onFailure` (array of processors) and `ignoreFailure` (true/false) unless otherwise stated.

| Processor | Purpose | Key fields |
| --- | --- | --- |
| `append` | Append value to array | `source`, `array`, `targetField` |
| `appendToOutputStream` | Emit value to Pulsar output | `source`, `output` |
| `break` | Exit a `foreach` loop | — |
| `convert` | Convert value type | `source`, `type`, `targetField` |
| `copy` | Copy value | `source`, `targetField` |
| `discard` | Drop the message | — |
| `eval` | Run JS expression | `source`, `targetField` (optional) |
| `foreach` | Iterate array/map | `source`, `processors`, `keyVal`, `valField` |
| `grok` | Grok pattern matching | `source`, `pattern`, `targetField` |
| `if` | Conditional execution | `source`, `operator`, `value`, `processors`, `else` |
| `json` | Parse string to JSON | `source`, `targetField` |
| `log` | Log a message | `type`, `source` |
| `lookup` | Lookup cache/DB/file | `source`, `properties`, `fallback`, `targetField` |
| `math` | Numeric operations | `source`, `operation`, `value`, `targetField` |
| `regex` | Regex extraction | `source`, `pattern`, `targetField` |
| `remove` | Remove field | `source` |
| `rename` | Rename field | `source`, `targetField` |
| `replace` | Replace text (regex optional) | `source`, `pattern`, `replacement`, `targetField`, `regex` |
| `set` | Set value | `source`, `args`, `targetField` |
| `setOutputStream` | Override output topic | `output` |
| `sort` | Sort array | `source`, `targetField` |
| `split` | Split string | `source`, `delimiter`, `targetField` |
| `strcase` | Change case | `source`, `type`, `targetField` |
| `substr` | Substring | `source`, `start`, `end`, `targetField` |
| `switch` | Switch/case | `source`, `operator`, `case`, `default` |
| `trim` | Trim chars | `source`, `cutset`, `targetField` |

## Lookups

Lookup files define static key-value maps referenced by overrides.

```json
{
  "name": "alertTypeMap",
  "_type": "lookup",
  "lookup": {
    "1": "Fault",
    "2": "Outage",
    "3": "Overload"
  }
}
```

Use in a `set` processor:

```json
{
  "set": {
    "source": "$.lookups.alertTypeMap.%s",
    "args": [ "$.trap.variables[0].value" ],
    "targetField": "$.trap.varMapping"
  }
}
```

## Grok definitions

Grok files define custom patterns used by the `grok` processor.

```json
{
  "name": "Custom Grok Definition 1",
  "_type": "grok",
  "grok": {
    "VALUE": ".*",
    "COMMONMAC": "(?:(?:[A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2})",
    "DATA": ".*?"
  }
}
```

Use in a `grok` processor:

```json
{
  "grok": {
    "source": "$.syslog.datagram",
    "pattern": "%CISCO-LINK-5: The error message is: %{VALUE:message}",
    "targetField": "$.syslog.variables"
  }
}
```
