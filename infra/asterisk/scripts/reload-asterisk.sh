#!/usr/bin/env sh
set -eu

asterisk -rx "pjsip reload"
asterisk -rx "dialplan reload"

echo "Asterisk reloaded"

