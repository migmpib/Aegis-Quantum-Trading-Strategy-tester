# От "Хилера" к "Творцу": Итеративная Разработка в MCP

Вы уже реализовали "Хилера" (реактивный агент, лечащий раны). Теперь нам нужно добавить "Творца" (проактивный агент, создающий новое).

Для этого нужно ввести концепцию **"Мастерской Художника" (The Artist's Studio)** — безопасного пространства для черновиков и тестов, чтобы агент не экспериментировал прямо в `prod`.

## 1. Архитектура "Мастерской"

Вместо того чтобы писать файлы сразу в проект, мы создаем временные рабочие директории.

**Новые сущности:**
1.  **Workspaces:** Временные папки `.jules/studio/{task_id}/`.
2.  **Iterative Loop:** Цикл "Напиши -> Проверь -> Исправь".

## 2. Расширение кода MCP-сервера

Вам нужно добавить новые инструменты (Tools) в ваш `buraicrat-jules`.

### А. Инструмент: `create_draft`
Создает черновик файла в изолированной мастерской.

```javascript
// Внутри ListToolsRequestSchema
{
    name: "create_draft",
    description: "Create or update a file in the workspace (not production yet)",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
            filename: { type: "string" },
            content: { type: "string" }
        },
        required: ["task_id", "filename", "content"]
    }
}

// Внутри CallToolRequestSchema
if (name === "create_draft") {
    const { task_id, filename, content } = args;
    const workspacePath = path.join(PROJECT_ROOT, '.jules/studio', task_id);

    if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
    }

    fs.writeFileSync(path.join(workspacePath, filename), content);
    return { content: [{ type: "text", text: `Draft saved to .jules/studio/${task_id}/${filename}` }] };
}
```

### Б. Инструмент: `verify_draft` (Self-Correction)
Запускает команду проверки внутри мастерской.

```javascript
// Внутри ListToolsRequestSchema
{
    name: "verify_draft",
    description: "Run a shell command inside the workspace to verify the draft",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
            command: { type: "string" } // e.g., "node test.js" or "npm test"
        },
        required: ["task_id", "command"]
    }
}

// Внутри CallToolRequestSchema
if (name === "verify_draft") {
    const { task_id, command } = args;
    const workspacePath = path.join(PROJECT_ROOT, '.jules/studio', task_id);

    try {
        const { stdout, stderr } = await execAsync(command, { cwd: workspacePath });
        return {
            content: [{ type: "text", text: `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}` }]
        };
    } catch (e) {
        return {
            isError: true,
            content: [{ type: "text", text: `EXIT CODE: ${e.code}\nSTDERR:\n${e.stderr}` }]
        };
    }
}
```

### В. Инструмент: `promote_to_production`
Когда тесты прошли, переносим файлы в основной проект через систему Proposals (безопасно).

```javascript
// Внутри ListToolsRequestSchema
{
    name: "promote_to_production",
    description: "Create a proposal to move drafts to the main project",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
            target_dir: { type: "string" }
        },
        required: ["task_id", "target_dir"]
    }
}

// Внутри CallToolRequestSchema
if (name === "promote_to_production") {
    // Здесь мы генерируем proposal, который копирует файлы из .jules/studio в реальный проект
    const proposalId = `promote_${args.task_id}_${Date.now()}`;
    proposals.set(proposalId, {
        type: 'promotion',
        source: `.jules/studio/${args.task_id}`,
        target: args.target_dir,
        status: 'pending'
    });
    return { content: [{ type: "text", text: `Promotion proposal created: ${proposalId}` }] };
}
```

## 3. Сценарий Итеративной Разработки

Вот как "Мозг" (Gemini) будет использовать эти новые инструменты:

**Запрос:** "Напиши функцию `calculate_tax.js` и убедись, что она работает".

1.  **Итерация 1 (Draft):**
    *   Agent -> `create_draft(task_id="tax_feat", filename="calculate_tax.js", content="...")`
    *   Agent -> `create_draft(task_id="tax_feat", filename="test.js", content="assert(calculate_tax(100) == 120)")`

2.  **Итерация 2 (Verify):**
    *   Agent -> `verify_draft(task_id="tax_feat", command="node test.js")`
    *   Result -> `Error: calculate_tax is not defined`.

3.  **Итерация 3 (Self-Correction):**
    *   Агент видит ошибку. Понимает, что забыл `module.exports`.
    *   Agent -> `create_draft(task_id="tax_feat", filename="calculate_tax.js", content="... module.exports = ...")`
    *   Agent -> `verify_draft(...)`
    *   Result -> `Success`.

4.  **Финал (Promote):**
    *   Agent -> `promote_to_production(task_id="tax_feat", target_dir="src/utils")`

**Итог:** В основной код попадает только **проверенный** код. Все ошибки остались в песочнице `.jules/studio`.
