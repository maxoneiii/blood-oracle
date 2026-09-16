# Первый релиз на GitHub — по шагам

Инструкция для того, кто с гитом раньше не работал. Всё на Windows.
В квадратных скобках — то, что нужно подставить своё.

Один раз проходятся части 1–5. Дальше, при каждом обновлении модуля, — только
часть 6.

---

## 1. Поставить Git

Скачай с https://git-scm.com/download/win и установи. Все галочки по умолчанию
подходят.

Вместе с гитом ставится **Git Bash** — отдельная консоль. Она понадобится,
если захочешь пользоваться `release.sh`. Если нет — есть версия для PowerShell,
о ней ниже.

Проверь, что встало. Открой PowerShell и набери:

```
git --version
```

Должна появиться строка с номером версии. Если пишет, что команда не найдена —
перезапусти PowerShell, иначе он не увидит новый Git.

## 2. Представиться гиту

Один раз на машину. Имя и почта попадут в историю изменений — можно любые.

```
git config --global user.name "Max"
git config --global user.email "max@example.com"
```

## 3. Завести репозиторий на GitHub

Зарегистрируйся на https://github.com, если аккаунта нет.

Нажми **+** справа сверху → **New repository**. Заполни:

- **Owner** — `maxoneiii`. Это важно: репозиторий должен принадлежать тому
  аккаунту, под которым Git авторизован на этой машине, иначе push упрётся в
  ошибку доступа
- **Repository name** — `blood-oracle`
- **Public** — обязательно. Foundry не сможет скачивать из приватного
- **Add a README file** — галочку **не** ставь, README у нас уже свой
- остальное не трогай

Нажми **Create repository**. Откроется страница с адресом вида
`https://github.com/maxoneiii/blood-oracle` — он понадобится дальше.

## 4. Проверить адреса в модуле

Уже заполнено, менять ничего не нужно. Для справки — в `module.json` есть четыре
поля с адресом репозитория:

```json
"url": "https://github.com/maxoneiii/blood-oracle",
"manifest": "https://github.com/maxoneiii/blood-oracle/releases/latest/download/module.json",
"download": "https://github.com/maxoneiii/blood-oracle/releases/latest/download/module.zip",
"readme": "https://github.com/maxoneiii/blood-oracle#readme"
```

Они указывают на последний релиз, поэтому при обновлениях их править не нужно.
Менять придётся, только если сменишь аккаунт или имя репозитория.

## 5. Залить код

Открой PowerShell и перейди в папку с **исходниками** модуля — той, где лежат
`src`, `tools` и `package.json`:

```
cd [путь к папке исходников]
```

Проверь, что попал куда надо:

```
dir
```

Должны быть видны `src`, `tools`, `package.json`. Если вместо них только `dist`,
`fonts` и `icons` — это установленная копия внутри Foundry, а не исходники.
Работать в ней нельзя: при обновлении модуля Foundry заменяет эту папку целиком,
вместе с историей git.

Дальше пять команд подряд:

```
git init
git add .
git commit -m "Первая версия"
git remote add origin https://github.com/maxoneiii/blood-oracle.git
git push -u origin main
```

Что они делают: заводят репозиторий в этой папке, набирают все файлы, сохраняют
их с подписью, привязывают к GitHub и отправляют туда.

При `git push` откроется окно входа в GitHub — войди через браузер, оно само
всё запомнит.

Если `git push` пишет `src refspec main does not match any` — ветка называется
`master`, так делает старый Git. Переименуй и повтори:

```
git branch -M main
git push -u origin main
```

Обнови страницу репозитория в браузере — файлы должны появиться.

Папок `dist`, `node_modules` и файла справочника там быть **не должно**. Это
нормально и так задумано: справочник содержит текст из книг и публиковаться не
может.

## 6. Собрать и выложить релиз

**Это то, что повторяется при каждом обновлении.**

### 6.1. Поднять номер версии

В `module.json` найди строку `"version"` и увеличь номер, например с `0.2.0`
на `0.2.1`. Foundry сравнивает его с установленным и по нему понимает, что
вышло обновление. Если забыть — обновление не предложится.

### 6.2. Собрать

В PowerShell, в папке модуля:

```
npm install
powershell -ExecutionPolicy Bypass -File tools\release.ps1
```

`npm install` нужен только первый раз.

Появится папка `build`, а в ней два файла: `module.zip` и `module.json`.

Если предпочитаешь Git Bash — там то же самое делает `./tools/release.sh`.

### 6.3. Отправить изменения на GitHub

```
git add .
git commit -m "Версия 0.2.1"
git push
```

### 6.4. Создать релиз

На странице репозитория справа найди **Releases** → **Create a new release**.

- **Choose a tag** — впиши `v0.2.1` и нажми **Create new tag**
- **Release title** — `0.2.1`
- **Attach binaries** — перетащи туда **оба** файла из папки `build`:
  `module.zip` и `module.json`

Имена файлов менять нельзя — на них ссылается манифест.

Нажми **Publish release**.

## 7. Проверить

Ссылка для установки выглядит так:

```
https://github.com/maxoneiii/blood-oracle/releases/latest/download/module.json
```

Открой её в браузере. Должен скачаться или показаться `module.json`. Если
GitHub пишет «Not Found» — значит файл не прикреплён к релизу или назван иначе.

Дальше в Foundry: **Add-on Modules → Install Module**, вставь эту ссылку в поле
**Manifest URL** внизу и нажми **Install**.

Эту же ссылку даёшь другим мастерам. После установки Foundry сам будет
предлагать им обновления, когда ты выложишь новый релиз.

---

## Если что-то пошло не так

**`git push` требует логин и пароль, пароль не подходит.** GitHub давно не
принимает пароль от аккаунта. Должно открыться окно браузера для входа — если
не открылось, поставь https://cli.github.com и выполни `gh auth login`.

**`Permission to … denied to [другое-имя]`, ошибка 403.** Windows запомнил
другой аккаунт GitHub и ходит под ним. Открой **Панель управления → Диспетчер
учётных данных → Учётные данные Windows**, найди строку `git:https://github.com`
и удали её. Следующий `git push` спросит вход заново.

Если не помогло, укажи аккаунт прямо в адресе:

```
git remote set-url origin https://maxoneiii@github.com/maxoneiii/blood-oracle.git
git push -u origin main
```

**Репозиторий создан не на том аккаунте.** Удалить: страница репозитория →
**Settings** → в самом низу **Danger Zone** → **Delete this repository**. Затем
создать заново на нужном аккаунте и переставить адрес:

```
git remote set-url origin https://github.com/maxoneiii/blood-oracle.git
```

**`npm` не найден.** Нужен Node.js — https://nodejs.org, версия 24.

**`release.ps1` не запускается из-за политики выполнения.** Именно поэтому в
команде есть `-ExecutionPolicy Bypass`. Запускай строкой целиком, как написано
выше.

**В релиз попал справочник.** Проверь, что файл `blood-oracle-rules.json` лежит
в `Data/blood-oracle/` у Foundry, а не в папке с исходниками модуля.
