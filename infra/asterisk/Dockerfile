FROM andrius/asterisk:20

RUN rm -rf /etc/asterisk/*.conf && mkdir -p /etc/asterisk

COPY config/ /etc/asterisk/
COPY scripts/reload-asterisk.sh /usr/local/bin/reload-asterisk.sh

RUN chmod +x /usr/local/bin/reload-asterisk.sh

CMD ["asterisk", "-f", "-p"]

