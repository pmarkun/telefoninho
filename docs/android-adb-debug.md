# Android ADB debug notes

## Devices in this test setup

| Serial | SIP extension | Person | Screen notes |
| --- | --- | --- | --- |
| `RQCW702390V` | `1001` | Pedro | 1080x2640 |
| `RQCX702YHWM` | `1004` | Maria | 1080x2340 |

## Install and restart both apps

```bash
adb -s RQCW702390V install -r apps/child-android/app/build/outputs/apk/debug/app-debug.apk
adb -s RQCX702YHWM install -r apps/child-android/app/build/outputs/apk/debug/app-debug.apk

adb -s RQCW702390V logcat -c
adb -s RQCX702YHWM logcat -c

adb -s RQCW702390V shell am force-stop com.telefoninho.child
adb -s RQCX702YHWM shell am force-stop com.telefoninho.child

adb -s RQCW702390V shell monkey -p com.telefoninho.child 1
adb -s RQCX702YHWM shell monkey -p com.telefoninho.child 1
```

## Useful logs

```bash
adb -s RQCW702390V logcat -d -v time TelefoninhoVoip:I '*:S'
adb -s RQCX702YHWM logcat -d -v time TelefoninhoVoip:I '*:S'
```

## Known tap coordinates

Coordinates are absolute pixels from the current UI dumps. Re-dump if the layout changes.

### Pedro device, `RQCW702390V`

- Call Maria: tap center of Maria card, around `768 1067`.
- Hang up active call: tap center of `DESLIGAR`, around `540 1648`.

Known bounds:

```txt
Maria card: [558,857][978,1277]
DESLIGAR button: [102,1540][978,1756]
```

### Maria device, `RQCX702YHWM`

- Call Pedro: tap center of Pedro card, around `310 933`.
- Accept incoming Pedro call: tap center of `ATENDER`, around `540 1265`.
- Hang up active call: re-dump UI, then tap center of `DESLIGAR`.

Known bounds:

```txt
Pedro card: [96,719][523,1146]
ATENDER button: [96,1164][984,1367]
```

## Asterisk checks

```bash
ssh root@vps68379.publiccloud.com.br 'cd /opt/telefoninho && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T asterisk asterisk -rx "pjsip show contacts"'

ssh root@vps68379.publiccloud.com.br 'cd /opt/telefoninho && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T asterisk asterisk -rx "core show channels verbose"'
```
