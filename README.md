# DotaCodex

Учебный MVP русскоязычной вики по Dota 2. В проекте есть каталог героев и предметов, история патчей, гайды, сравнение героев и REST API.

> Данные в базе демонстрационные. Они не являются актуальной игровой справкой. Авторизация и отправка электронной почты пока не реализованы.

## Возможности

- Поиск по героям, предметам и гайдам.
- Фильтры героев по атрибуту, роли и типу атаки.
- Карточки героев со способностями, талантами и рекомендованными предметами.
- Каталоги предметов и изменений патчей.
- Просмотр гайдов и форма создания гайда.
- Сравнение характеристик двух героев.
- REST API на Node.js с данными PostgreSQL в Supabase.
- Сборка Tailwind CSS и тесты на `node:test`.

## Технологии

- Node.js 22.13 или новее
- PostgreSQL в Supabase
- Tailwind CSS 4
- Docker
- GitHub Actions и GitHub Container Registry (GHCR)

## Локальный запуск

1. Установи Node.js 22.13+ и создай проект Supabase.
2. Скопируй URI подключения к базе из Supabase. Если прямое подключение недоступно, используй **Session pooler**.
3. Создай локальный файл окружения:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

4. В `.env` укажи строку подключения:

   ```dotenv
   DATABASE_URL=postgresql://...
   ```

5. Установи зависимости, создай таблицы и демонстрационные записи, затем запусти сервер:

   ```powershell
   npm ci
   npm run db:setup
   npm start
   ```

6. Открой <http://localhost:8000>.

Не публикуй `.env` и не вставляй строку подключения в клиентский код. Файл `.env` исключён из Git.

## Команды проекта

```powershell
npm start          # собрать CSS и запустить сервер
npm run dev        # режим разработки с перезапуском сервера
npm run build:css  # собрать Tailwind CSS
npm run watch:css  # пересобирать CSS при изменениях
npm run db:setup   # создать схему и загрузить демонстрационные данные
npm test           # запустить тесты
```

## Запуск через Docker

Убедись, что Docker Desktop запущен и в корне проекта есть настроенный `.env`.

```powershell
docker build -t dotacodex:local .
docker run --rm --name dotacodex -d --env-file .env -p 8000:8000 dotacodex:local
docker ps
docker logs dotacodex
```

Приложение будет доступно по адресу <http://localhost:8000>. Остановить контейнер можно командой:

```powershell
docker stop dotacodex
```

## GitHub Actions и GHCR

Workflow находится в `.github/workflows/ci.yml` и запускается при `push` и `pull_request`.

1. В настройках репозитория открой **Settings → Secrets and variables → Actions**.
2. Создай секрет `SUPABASE_DATABASE_URL` со строкой подключения к Supabase. Без него шаг подготовки базы и тесты не смогут подключиться к базе.
3. При push в `main` после успешной проверки workflow собирает Docker-образ и публикует его в GHCR по адресу `ghcr.io/kaba4ok337/dotacodex` с тегами `latest` и SHA коммита.
4. Результаты сборки смотри во вкладке **Actions**, опубликованный образ — в разделе **Packages**.

Новый пакет GHCR обычно приватный. Чтобы разрешить скачивание без авторизации, измени его видимость в настройках пакета.

## Структура проекта

```text
.
├── .github/workflows/ci.yml  # CI и публикация Docker-образа
├── db/                       # схема БД, демонстрационные данные и ER-диаграмма
├── design-reference/         # SVG-макеты интерфейса
├── public/                   # статические ресурсы
├── scripts/setup-db.js       # настройка базы данных
├── screenshots/              # скриншоты проекта
├── src/input.css             # Tailwind CSS
├── tests/                    # автоматические тесты
├── Dockerfile
├── app.js                     # интерфейс и навигация
├── index.html
├── package.json
└── server.js                  # HTTP-сервер и REST API
```

## Ограничения

- Содержимое базы — учебные примеры; проверь актуальные игровые сведения перед использованием.
- Полноценной авторизации и проверки прав пользователей нет.
- Перед публичным использованием приложения настрой аутентификацию и защиту API.
