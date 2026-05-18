#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════╗${NC}"
echo -e "${CYAN}║   TechStore — просмотр БД    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}1${NC}) PostgreSQL  — Practice 19 (порт 5432)"
echo -e "  ${GREEN}2${NC}) MongoDB     — Practice 20 (порт 27017)"
echo -e "  ${GREEN}3${NC}) Redis       — Practice 21 (порт 6379)"
echo -e "  ${GREEN}0${NC}) Выход"
echo ""
read -p "Выбери БД [0-3]: " choice

case $choice in
  1)
    echo ""
    echo -e "${YELLOW}━━━ PostgreSQL (kr4_p19) ━━━${NC}"
    echo ""
    psql -d kr4_p19 -c "SELECT id, title, category, price FROM products ORDER BY id;"
    echo ""
    psql -d kr4_p19 -c "SELECT id, email, role, blocked FROM users ORDER BY id;"
    ;;
  2)
    echo ""
    echo -e "${YELLOW}━━━ MongoDB (kr4_techstore) ━━━${NC}"
    if ! docker ps | grep -q mongo-kr4; then
      echo "Запускаю MongoDB контейнер..."
      docker start mongo-kr4 2>/dev/null || docker run -d --name mongo-kr4 -p 27017:27017 mongo:7
      sleep 3
    fi
    echo ""
    echo "=== Товары ==="
    docker exec mongo-kr4 mongosh --quiet --eval \
      'use("kr4_techstore"); db.products.find({},{title:1,category:1,price:1,_id:0}).forEach(p=>print(JSON.stringify(p)))'
    echo ""
    echo "=== Пользователи ==="
    docker exec mongo-kr4 mongosh --quiet --eval \
      'use("kr4_techstore"); db.users.find({},{email:1,role:1,blocked:1,_id:0}).forEach(u=>print(JSON.stringify(u)))'
    ;;
  3)
    echo ""
    echo -e "${YELLOW}━━━ Redis (кэш) ━━━${NC}"
    if ! docker ps | grep -q redis-kr4; then
      echo "Запускаю Redis контейнер..."
      docker start redis-kr4 2>/dev/null || docker run -d --name redis-kr4 -p 6379:6379 redis:alpine
      sleep 2
    fi
    echo ""
    KEYS=$(docker exec redis-kr4 redis-cli KEYS '*')
    if [ -z "$KEYS" ]; then
      echo "Кэш пустой. Сделай хотя бы один GET-запрос к Practice 21."
    else
      echo "Ключи в кэше:"
      while IFS= read -r key; do
        TTL=$(docker exec redis-kr4 redis-cli TTL "$key")
        echo -e "  ${GREEN}$key${NC}  (осталось ${TTL}с)"
      done <<< "$KEYS"
      echo ""
      echo "Введи ключ для просмотра содержимого (или Enter чтобы пропустить):"
      read -p "> " keyname
      if [ -n "$keyname" ]; then
        docker exec redis-kr4 redis-cli GET "$keyname" | python3 -m json.tool 2>/dev/null || \
        docker exec redis-kr4 redis-cli GET "$keyname"
      fi
    fi
    ;;
  0)
    echo "Выход."
    exit 0
    ;;
  *)
    echo "Неверный выбор."
    ;;
esac
