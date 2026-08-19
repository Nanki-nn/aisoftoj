FROM nginx:1.27-alpine

COPY frontend-nginx.conf /etc/nginx/nginx.conf
COPY frontend/ /usr/share/nginx/html/

RUN find /usr/share/nginx/html -type d -exec chmod 0755 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 0644 {} +

USER nginx
EXPOSE 8080

ENTRYPOINT ["/usr/sbin/nginx"]
CMD ["-g", "daemon off;"]
