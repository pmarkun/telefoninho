FROM andrius/asterisk:20

RUN rm -rf /etc/asterisk/*.conf && mkdir -p /etc/asterisk

COPY config/ /etc/asterisk/
COPY scripts/reload-asterisk.sh /usr/local/bin/reload-asterisk.sh
COPY scripts/start-asterisk.sh /usr/local/bin/start-asterisk.sh

RUN chmod +x /usr/local/bin/reload-asterisk.sh /usr/local/bin/start-asterisk.sh

CMD ["start-asterisk.sh"]
