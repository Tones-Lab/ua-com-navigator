# NCE Legacy Conversion Deep Dive: Unconverted Snippets

## Scope reviewed

- Report source: `tmp/legacy-analysis/nce/legacy-conversion-report.json`
- Input root: `rules/legacy/uploads/NCE`
- Generated with backend converter (`legacy:convert`) using `--dry-run --no-llm`

## High-level findings

- Files analyzed: 48
- Legacy objects: 27
- Override proposals: 24
- Matched diffs: 3
- Unknown files: 22 (mostly `.pl` lookup/helper artifacts)
- Unique non-literal expressions left raw in proposals: 17

## Post-enhancement rerun (with variable lineage mapping enabled)

After implementing generic variable lineage mapping in the converter and rerunning the same NCE input set:

- Processor stubs: 98 total
  - Direct: 81
  - Conditional: 13
  - Manual: 4
- Lookup stubs: 14

This is a substantial reduction in unresolved conditional stubs versus the prior pass.

## Processor behavior used for mapping

- **copy**: move one JSONPath value to a target field.
- **set + args**: build strings from one or more values (`%s` placeholders).
- **replace**: mutate existing string content by pattern.
- **if**: conditional set/replace chains.
- **regex**: extract substrings for conditional formatting.
- **lookup**: convert `.pl` table-style helpers to lookup objects where appropriate.

## One-by-one review of current unconverted expressions

| # | Legacy expression | Seen in target field(s) | Suggested FCOM behavior | Status |
|---|---|---|---|---|
| 1 | `$ip` | `Node` | `copy`/`set` from source path (likely trap source IP or parsed field) | Conditional (needs exact source path) |
| 2 | `$Event->{'EMSName'}` | `SubNode` | `copy` from `$.event.EMSName` | Direct |
| 3 | `$Event->{'EMSName'} . " EMS Heartbeat"` | `Summary` | `set` with `source: "%s EMS Heartbeat"`, `args:["$.event.EMSName"]` | Direct |
| 4 | `$iMAPNorthboundHeartbeatSystemLabel` | `Node` | `copy`/`set` from mapped trap variable | Conditional |
| 5 | `$iMAPNorthboundAlarmParas2 . " - " .$iMAPNorthboundAlarmParas4` | `Summary` | `set` with two args (`%s - %s`) from mapped variables/fields | Conditional |
| 6 | `$iMAPNorthboundAlarmMOName` | `Node` | `copy`/`set` from mapped trap variable | Conditional |
| 7 | `$iMAPNorthboundAlarmID` | `SubNode` | `copy`/`set` from mapped trap variable | Conditional |
| 8 | `$hwNmNorthboundNEName` | `Node` | `copy`/`set` from mapped trap variable | Conditional |
| 9 | `$hwNmNorthboundFaultID` | `SubNode` | `copy`/`set` from mapped trap variable | Conditional |
| 10 | `$Event->{'EMSName'} . ": Alarm Synchronization START"` | `Summary` | `set` with `"%s: Alarm Synchronization START"` + `$.event.EMSName` | Direct |
| 11 | `$Event->{'EMSName'} . ": Alarm Synchronization END"` | `Summary` | `set` with `"%s: Alarm Synchronization END"` + `$.event.EMSName` | Direct |
| 12 | `"1.3.6.1.4.1.2011.2.15.1.7.1" . "|" . $generic . "|1"` | `HelpKey` | `set` with format `%s|%s|%s` and mapped generic value | Conditional |
| 13 | `$hwNmNorthboundEventName` | `Summary` | `copy`/`set` from mapped trap variable | Conditional |
| 14 | `$Event->{'HelpKey'} . " - " .  $iMAPNorthboundAlarmCSN` | `HelpKey` | `set` with `%s - %s`, args from `$.event.HelpKey` + mapped var | Conditional |
| 15 | `$hwNmNorthboundEventName . " (" . $hwNmNorthboundFaultID .") - " . $extracted_value` | `Summary` | `regex` extract + `if` + `set` composition | Conditional (multi-processor) |
| 16 | `$Event->{Summary} . " (Severity downgraded Critical --> Major)"` | `Summary` | `if` on severity + `set` append pattern + severity `set` to 4 | Direct |
| 17 | `$Event->{'HelpKey'} . " - " .  $iMAPNorthboundAlarmNEType . " - ". $iMAPNorthboundAlarmID` | `HelpKey` | `set` with three args (`%s - %s - %s`) | Conditional |

## What can/should be converted now

### Convert now (high confidence)

- Event-field-only concatenations and appends (`#2, #3, #10, #11, #16`)
- These can be transformed to canonical FCOM processors immediately (`set`, `copy`, `if`).

### Convert with source-path mapping (medium confidence)

- Variable-only or mixed expressions (`#1, #4–#9, #12–#15, #17`)
- They are still COM-convertible, but require one extra mapping layer from legacy Perl vars (`$vN`, `$generic`, local vars) to concrete JSONPaths.
- Once the var mapping exists, conversion can be deterministic.

### Not “event override” but still convertible artifacts

- Many `.pl` files should become lookup objects and be consumed with the `lookup` processor where behavior is table-driven.

## Practical conversion strategy for current pipeline

1. Add expression normalization for `$Event->{Field}` references:
   - `$Event->{'X'}` -> `$.event.X`
2. Detect Perl concatenation patterns (`a . "text" . b`) and emit `set` + `args`.
3. Build a var-map from local assignments (`my $foo = $v9;`) to source JSONPaths (e.g., trap variable paths).
4. For append-in-place patterns (`$Event->{Summary} = $Event->{Summary} . "..."`), emit `set` with existing field as first arg.
5. For extract-then-compose patterns (`$x =~ /.../; ... $x ...`), emit `regex` + `if` + `set` chain.
6. Convert lookup-like `.pl` dictionaries into lookup COM files and emit `lookup` processor usage instead of raw variable strings.

## Example normalized output for the heartbeat case

Legacy:

```perl
$Event->{'Summary'} = $Event->{'EMSName'} . " EMS Heartbeat";
```

FCOM override processor:

```json
{
  "set": {
    "source": "%s EMS Heartbeat",
    "args": ["$.event.EMSName"],
    "targetField": "$.event.Summary"
  }
}
```
