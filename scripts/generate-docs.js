const fs = require('fs');
const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));

const BASE_URL = swagger.servers?.[0]?.url || 'http://localhost:3000/api';

function resolveRef(ref, root) {
    const parts = ref.replace('#/', '').split('/');
    let obj = root;
    for (const p of parts) obj = obj?.[p];
    return obj;
}

function resolveSchema(schema, root) {
    if (!schema) return schema;
    if (schema.$ref) return resolveRef(schema.$ref, root);
    return schema;
}

function generateExample(schema, root, depth = 0) {
    if (!schema) return null;
    if (schema.$ref) schema = resolveRef(schema.$ref, root);
    if (!schema) return null;
    if (schema.example !== undefined) return schema.example;
    if (schema.type === 'object' && schema.properties) {
        const obj = {};
        for (const [key, val] of Object.entries(schema.properties)) {
            obj[key] = generateExample(val, root, depth + 1);
        }
        return obj;
    }
    if (schema.type === 'array') {
        const item = generateExample(schema.items, root, depth + 1);
        return item !== null ? [item] : [];
    }
    if (schema.allOf) {
        let merged = {};
        for (const sub of schema.allOf) {
            const resolved = sub.$ref ? resolveRef(sub.$ref, root) : sub;
            const ex = generateExample(resolved, root, depth + 1);
            if (ex && typeof ex === 'object') merged = { ...merged, ...ex };
        }
        return merged;
    }
    if (schema.enum) return schema.enum[0];
    switch (schema.type) {
        case 'string': return schema.format === 'date-time' ? '2026-01-15T08:00:00.000Z' : (schema.format === 'binary' ? '(binary)' : 'string');
        case 'number': return 0;
        case 'integer': return 0;
        case 'boolean': return true;
        case 'object': return { text: "Olá do W-AZAP!" };
        default: return null;
    }
}

function paramExample(param) {
    if (param.example) return param.example;
    if (param.schema?.example) return param.schema.example;
    if (param.name === 'sessionId') return 'vendas-01';
    if (param.name === 'jid') return '5511987654321%40s.whatsapp.net';
    if (param.name === 'id') return 'abc123';
    if (param.name === 'messageId') return 'MSG_ID_123';
    if (param.name === 'labelId') return 'label_01';
    if (param.name === 'replyId') return 'reply_01';
    if (param.name === 'scheduleId') return 'sched_01';
    if (param.name === 'filename') return 'image.jpg';
    if (param.name === 'action') return 'start';
    return 'value';
}

// Generate a properties table from a schema (shows enum, default, required, description)
function generateFieldsTable(schema, root, requiredFields) {
    if (!schema) return '';
    schema = resolveSchema(schema, root);
    if (!schema || !schema.properties) return '';

    const required = requiredFields || schema.required || [];
    let table = '';
    table += `| Campo | Tipo | Obrigatório | Descrição |\n`;
    table += `| :--- | :--- | :--- | :--- |\n`;

    for (const [name, prop] of Object.entries(schema.properties)) {
        const resolved = resolveSchema(prop, root);
        let type = resolved.type || 'any';
        let desc = resolved.description || '';
        const isRequired = required.includes(name) ? '✅ Sim' : 'Não';

        // Show enum options
        if (resolved.enum) {
            desc += (desc ? ' ' : '') + '**Opções:** `' + resolved.enum.join('`, `') + '`';
        }

        // Show default value
        if (resolved.default !== undefined) {
            desc += (desc ? ' ' : '') + '**Padrão:** `' + resolved.default + '`';
        }

        // Show nullable
        if (resolved.nullable) {
            type += ', nullable';
        }

        // Show array item type
        if (resolved.type === 'array' && resolved.items) {
            const itemSchema = resolveSchema(resolved.items, root);
            const itemType = itemSchema?.type || 'object';
            type = `array de ${itemType}`;
        }

        // Show format
        if (resolved.format) {
            type += ` (${resolved.format})`;
        }

        table += `| \`${name}\` | ${type} | ${isRequired} | ${desc || '—'} |\n`;
    }
    return table + '\n';
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const routeCount = Object.keys(swagger.paths).length;

let md = '';
md += `# Documentação da API do W-AZAP\n\n`;
md += `> Arquivo gerado automaticamente a partir de \`src/lib/swagger.ts\`: não edite à mão. Para atualizar, rode \`npx tsx scripts/generate-swagger.ts && node scripts/generate-docs.js\`.\n\n`;
md += `**Versão ${pkg.version}** · **${routeCount} rotas** · URL base: \`${BASE_URL}\`\n\n`;
md += `API REST do gateway de WhatsApp W-AZAP para automação completa: sessões, mensagens, grupos, contatos, etiquetas, agendamentos, respostas automáticas e webhooks. Para explorar de forma interativa, use o Swagger UI em \`/swagger\` (exige login no painel).\n\n`;

// Auth section
md += `## 🔐 Autenticação\n\n`;
md += `Todos os endpoints exigem uma das formas de autenticação abaixo:\n\n`;
md += `| Método | Cabeçalho / Cookie | Exemplo |\n`;
md += `| :--- | :--- | :--- |\n`;
md += `| **Chave de API** | \`X-API-Key\` (cabeçalho) | \`X-API-Key: wag_sua-chave\` |\n`;
md += `| **Cookie de login** | \`authjs.session-token\` (em HTTPS: \`__Secure-authjs.session-token\`) | Enviado automaticamente pelo navegador |\n\n`;
md += `- Gere a chave em **Painel › Webhooks e API**. Ela é exibida **uma única vez** e fica guardada só como hash; se perder, gere outra.\n`;
md += `- Rotas administrativas (gestão de usuários, geração de chave) aceitam apenas o cookie de login.\n`;
md += `- Cada usuário só acessa as próprias sessões ou as compartilhadas com ele; o \`SUPERADMIN\` acessa todas. Sem permissão, a resposta é \`403\`.\n\n`;

md += `## 📋 Parâmetros comuns\n\n`;
md += `| Parâmetro | Formato | Exemplo |\n`;
md += `| :--- | :--- | :--- |\n`;
md += `| \`sessionId\` | Identificador da sessão (3 a 50 letras, números, \`-\` ou \`_\`) | \`vendas-01\` |\n`;
md += `| \`jid\` (contato) | \`{DDI}{DDD}{número}@s.whatsapp.net\` | \`5511987654321@s.whatsapp.net\` |\n`;
md += `| \`jid\` (grupo) | \`{idDoGrupo}@g.us\` | \`120363123456789@g.us\` |\n\n`;
md += `> Codifique o JID ao usá-lo na URL: \`@\` vira \`%40\` (ex.: \`5511987654321%40s.whatsapp.net\`).\n\n`;

md += `## 📊 Limites e respostas\n\n`;
md += `| Situação | Código | Observação |\n`;
md += `| :--- | :--- | :--- |\n`;
md += `| Muitas requisições | \`429\` | Limite de \`RATE_LIMIT_PER_MINUTE\` por minuto (padrão: 60). Veja os cabeçalhos \`X-RateLimit-Remaining\` e \`Retry-After\`. |\n`;
md += `| Corpo grande demais | \`413\` | Limite de \`MAX_UPLOAD_SIZE_MB\` (padrão: 50 MB). |\n`;
md += `| URL de mídia/webhook interna | \`400\` | Endereços privados (\`localhost\`, \`192.168.x.x\`…) são bloqueados contra SSRF. |\n`;
md += `| Sessão desconectada | \`503\` | Inicie a sessão ou leia o QR code de novo. |\n\n`;
md += `Todas as respostas seguem o formato \`{ "status": true|false, "message": "...", "data": ... }\`.\n\n`;

md += `> **Webhooks**: cada entrega é assinada com HMAC-SHA256 no cabeçalho \`X-Webhook-Signature\`. Veja a seção *Verificação HMAC dos webhooks*, logo após os endpoints de Webhooks, com exemplos em Node.js, Python, PHP e Go.\n\n`;
md += `---\n\n`;

// Group by tags
const tagMap = {};
for (const [path, methods] of Object.entries(swagger.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
        const tag = spec.tags?.[0] || 'Outros';
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push({ path, method: method.toUpperCase(), spec });
    }
}

// Hand-written sections appended after a tag's endpoints
const tagAppendix = {
    Webhooks: fs.readFileSync('scripts/docs/webhooks.pt-BR.md', 'utf8'),
};

for (const [tag, endpoints] of Object.entries(tagMap)) {
    md += `## 📂 ${tag}\n\n`;

    for (const { path, method, spec } of endpoints) {
        const deprecated = spec.deprecated ? '~~' : '';
        md += `### ${deprecated}\\[${method}\\] ${path}${deprecated}\n\n`;
        if (spec.deprecated) md += `> ⚠️ **OBSOLETO**: ${spec.description || ''}\n\n`;

        md += `**${spec.summary || ''}**\n\n`;
        if (spec.description && !spec.deprecated) md += `${spec.description}\n\n`;

        // Parameters table (path, query)
        const params = spec.parameters || [];
        if (params.length > 0) {
            md += `#### Parâmetros\n\n`;
            md += `| Nome | Local | Obrigatório | Tipo | Descrição |\n`;
            md += `| :--- | :--- | :--- | :--- | :--- |\n`;
            for (const p of params) {
                const type = p.schema?.type || 'string';
                let desc = p.description || '';
                if (p.schema?.enum) {
                    desc += (desc ? ' ' : '') + '**Opções:** `' + p.schema.enum.join('`, `') + '`';
                }
                if (p.schema?.default !== undefined) {
                    desc += (desc ? ' ' : '') + '**Padrão:** `' + p.schema.default + '`';
                }
                const where = { path: 'caminho', query: 'query', header: 'cabeçalho', cookie: 'cookie' }[p.in] || p.in;
                md += `| \`${p.name}\` | ${where} | ${p.required ? '✅ Sim' : 'Não'} | ${type} | ${desc || '—'} |\n`;
            }
            md += `\n`;
        }

        // Request body
        const reqBody = spec.requestBody;
        if (reqBody) {
            md += `#### Cabeçalhos\n\n`;
            md += `\`\`\`\nX-API-Key: sua-chave\nContent-Type: application/json\n\`\`\`\n\n`;

            const contentTypes = reqBody.content || {};
            for (const [ct, ctSpec] of Object.entries(contentTypes)) {
                md += `#### Corpo da requisição (\`${ct}\`)\n\n`;

                // Generate fields table with enum, default, required
                const schema = resolveSchema(ctSpec.schema, swagger);
                if (schema) {
                    const fieldsTable = generateFieldsTable(schema, swagger, schema.required);
                    if (fieldsTable) {
                        md += fieldsTable;
                    }
                }

                // JSON example
                const example = ctSpec.example || generateExample(ctSpec.schema, swagger);
                if (example && typeof example === 'object') {
                    md += `**Exemplo:**\n\n`;
                    md += `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\`\n\n`;
                } else if (ct === 'multipart/form-data') {
                    md += `> Envie como \`multipart/form-data\` com o campo \`file\`.\n\n`;
                }
            }
        }

        // Responses
        const responses = spec.responses || {};
        const responseCodes = Object.keys(responses);
        if (responseCodes.length > 0) {
            md += `#### Respostas\n\n`;
            md += `| Código | Descrição |\n`;
            md += `| :--- | :--- |\n`;
            for (const [code, resp] of Object.entries(responses)) {
                let resolved = resp;
                if (resp.$ref) resolved = resolveRef(resp.$ref, swagger);
                md += `| \`${code}\` | ${resolved?.description || ''} |\n`;
            }
            md += `\n`;

            // Show 200 response example
            let resp200 = responses['200'];
            if (resp200?.$ref) resp200 = resolveRef(resp200.$ref, swagger);
            if (resp200?.content) {
                for (const [ct, ctSpec] of Object.entries(resp200.content)) {
                    // Show response fields table
                    const respSchema = resolveSchema(ctSpec.schema, swagger);
                    if (respSchema && respSchema.properties) {
                        md += `**Campos da resposta (\`200\`):**\n\n`;
                        md += generateFieldsTable(respSchema, swagger);
                    }

                    const example = ctSpec.example || generateExample(ctSpec.schema, swagger);
                    if (example && typeof example === 'object') {
                        md += `**Exemplo de resposta (\`200\`):**\n\n`;
                        md += `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\`\n\n`;
                    }
                }
            }
        }

        // cURL example
        const pathParams = params.filter(p => p.in === 'path');
        const queryParams = params.filter(p => p.in === 'query');
        let curlPath = path;
        for (const p of pathParams) {
            curlPath = curlPath.replace(`{${p.name}}`, paramExample(p));
        }
        let curlUrl = `${BASE_URL}${curlPath}`;
        if (queryParams.length > 0) {
            const qs = queryParams.map(p => `${p.name}=${paramExample(p)}`).join('&');
            curlUrl += `?${qs}`;
        }

        md += `#### Exemplo em cURL\n\n`;
        md += `\`\`\`bash\ncurl -X ${method} "${curlUrl}"`;
        md += ` \\\n  -H "X-API-Key: sua-chave"`;

        if (reqBody) {
            const contentTypes = reqBody.content || {};
            const firstCt = Object.keys(contentTypes)[0];
            if (firstCt === 'multipart/form-data') {
                md += ` \\\n  -F "file=@/caminho/para/arquivo.jpg" \\\n  -F "type=image" \\\n  -F "caption=Olá"`;
            } else {
                md += ` \\\n  -H "Content-Type: application/json"`;
                const ctSpec = contentTypes[firstCt];
                const example = ctSpec?.example || generateExample(ctSpec?.schema, swagger);
                if (example && typeof example === 'object') {
                    const jsonStr = JSON.stringify(example);
                    md += ` \\\n  -d '${jsonStr}'`;
                }
            }
        }
        md += `\n\`\`\`\n\n`;
        md += `---\n\n`;
    }
    if (tagAppendix[tag]) md += tagAppendix[tag];
}

// Schemas section
md += `## 📦 Schemas (modelos de dados)\n\n`;
for (const [name, schema] of Object.entries(swagger.components?.schemas || {})) {
    md += `### ${name}\n\n`;
    const resolved = resolveSchema(schema, swagger);
    if (resolved && resolved.properties) {
        md += generateFieldsTable(resolved, swagger);
    }
    const example = generateExample(schema, swagger);
    if (example) {
        md += `**Exemplo:**\n\n`;
        md += `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\`\n\n`;
    }
}

fs.writeFileSync('docs/API_DOCUMENTATION.md', md, 'utf8');
console.log(`API_DOCUMENTATION.md gerado com ${routeCount} rotas.`);
