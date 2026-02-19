# Legacy to FCOM Field Mapping Examples

These examples map common legacy concatenation patterns (Perl-style `$Event->{...}`) into FCOM processors.

## Core rule from FCOM docs

- Use `$.event.*` in `post` scope only.
- In `pre` scope, `$.event.*` is not available.
- Build new strings with `set` + `source` format + `args`.
- Use `replace` only to mutate existing string content.

## 1) Single field + suffix

Legacy:

```perl
$Event->{'EMSName'} . " EMS Heartbeat"
```

FCOM (`post` scope):

```json
{
  "set": {
    "source": "%s EMS Heartbeat",
    "args": ["$.event.EMSName"],
    "targetField": "$.event.Summary"
  }
}
```

## 2) Prefix + field + suffix

Legacy:

```perl
"EMS " . $Event->{'EMSName'} . " heartbeat lost"
```

FCOM (`post` scope):

```json
{
  "set": {
    "source": "EMS %s heartbeat lost",
    "args": ["$.event.EMSName"],
    "targetField": "$.event.Summary"
  }
}
```

## 3) Multi-field key composition

Legacy:

```perl
$Event->{'Node'} . ":" . $Event->{'SubNode'} . ":" . $Event->{'EventType'}
```

FCOM (`post` scope):

```json
{
  "set": {
    "source": "%s:%s:%s",
    "args": ["$.event.Node", "$.event.SubNode", "$.event.EventType"],
    "targetField": "$.event.EventKey"
  }
}
```

## 4) Summary normalization (replacement case)

Legacy intent:

```perl
$Event->{'Summary'} =~ s/ ; /\//g
```

FCOM (`post` scope):

```json
{
  "replace": {
    "source": "$.event.Summary",
    "pattern": " ; ",
    "replacement": "/",
    "targetField": "$.event.Summary"
  }
}
```

## 5) Pre-scope caution

If your logic runs in `pre` scope, do not map directly to `$.event.*`.
Use available pre-scope structures (for example source payload fields) and map into intermediate fields first, then finalize to `$.event.*` in a `post` processor.

## Quick decision guide

- Creating a new output string from fields -> `set` with `%s` placeholders + `args`
- Modifying an existing string value -> `replace`
- Renaming only -> `rename`
- Plain copy (no formatting) -> `copy` or simple `set`
