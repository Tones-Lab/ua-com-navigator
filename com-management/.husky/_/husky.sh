#!/bin/sh
if [ -z "$husky_skip_init" ]; then
  readonly hook_name="$(basename "$0")"
  if [ -z "$HUSKY" ]; then
    export HUSKY=1
  fi
  export husky_skip_init=1
  sh -e "$0" "$@"
  exit $?
fi
