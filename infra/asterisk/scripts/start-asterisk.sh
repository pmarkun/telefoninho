#!/usr/bin/env sh
set -eu

ami_user="${ASTERISK_AMI_USERNAME:-telefoninho-api}"
ami_password="${ASTERISK_AMI_PASSWORD:-telefoninho-api-dev}"

cat > /etc/asterisk/manager.generated.conf <<EOF
[${ami_user}]
secret = ${ami_password}
read = system,call,command,reporting
write = system,call,command,originate
deny = 0.0.0.0/0.0.0.0
permit = 10.0.0.0/8
permit = 172.16.0.0/12
permit = 192.168.0.0/16
EOF

exec asterisk -f -p
