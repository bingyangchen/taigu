FROM nginx:latest AS dev_final
COPY ./nginx.dev.conf /etc/nginx/conf.d/default.conf
COPY ./dev-cert.pem /etc/ssl/certs/trade-smartly.com.pem
COPY ./dev-key.pem /etc/ssl/private/trade-smartly.com.key
EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
