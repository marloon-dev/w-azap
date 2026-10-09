import { prisma } from "@/lib/prisma";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { decryptString, encryptString, isEncryptedBlob } from "@/lib/data-encryption";

export const usePrismaAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    
    // Rows are bound to their session+key (AAD), so an encrypted value cannot be swapped between rows
    const aadFor = (key: string) => `${sessionId}:${key}`;

    // Helper to read JSON with Buffer handling (decrypts; legacy plaintext rows are migrated on read)
    const readData = async (type: string, id: string) => {
        const key = `${type}-${id}`;
        try {
            const data = await prisma.authState.findUnique({
                where: { sessionId_key: { sessionId, key } }
            });
            if (!data || !data.value) return null;

            if (isEncryptedBlob(data.value)) {
                return JSON.parse(decryptString(data.value, aadFor(key)), BufferJSON.reviver);
            }

            // Legacy plaintext row: return it and re-save encrypted
            const plain = JSON.parse(JSON.stringify(data.value), BufferJSON.reviver);
            writeData(type, id, plain).catch(() => { });
            return plain;
        } catch (error) {
            logger.error("Auth", `Error reading auth state ${key} (wrong DATA_ENCRYPTION_KEY?):`, error);
            return null;
        }
    };

    // Helper to write data (always encrypted at rest)
    const writeData = async (type: string, id: string, data: any) => {
        try {
            const key = `${type}-${id}`;
            const value = encryptString(JSON.stringify(data, BufferJSON.replacer), aadFor(key)) as any;
            
            await prisma.authState.upsert({
                where: { sessionId_key: { sessionId, key } },
                create: { sessionId, key, value },
                update: { value }
            });
        } catch (error) {
             logger.error("Auth", 'Error writing auth state:', error);
        }
    };

    const removeData = async (type: string, id: string) => {
        try {
            const key = `${type}-${id}`;
             await prisma.authState.deleteMany({
                where: { sessionId, key }
            });
        } catch (error) {
            // ignore
        }
    }


    const creds: AuthenticationCreds = (await readData('creds', 'me')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = BufferJSON.reviver(null, value);
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                     const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        const categoryData = data[category as keyof typeof data];
                        if (!categoryData) continue;
                        
                        for (const id in categoryData) {
                            const value = categoryData[id];
                             if (value) {
                                tasks.push(writeData(category, id, value));
                            } else {
                                tasks.push(removeData(category, id));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', 'me', creds);
        }
    }
}

/**
 * Encrypt every legacy plaintext auth-state row (one pass at startup). Rows written before
 * at-rest encryption existed would otherwise stay readable until Baileys happens to rewrite them.
 */
export async function encryptLegacyAuthState(): Promise<number> {
    let migrated = 0;
    let cursor: string | undefined;
    for (;;) {
        const rows = await prisma.authState.findMany({
            take: 200,
            ...(cursor && { skip: 1, cursor: { id: cursor } }),
            orderBy: { id: "asc" },
            select: { id: true, sessionId: true, key: true, value: true },
        });
        if (rows.length === 0) break;
        cursor = rows[rows.length - 1].id;
        for (const row of rows) {
            if (!row.value || isEncryptedBlob(row.value)) continue;
            const value = encryptString(JSON.stringify(row.value), `${row.sessionId}:${row.key}`) as any;
            await prisma.authState.update({ where: { id: row.id }, data: { value } });
            migrated++;
        }
    }
    if (migrated > 0) logger.info("Auth", `Encrypted ${migrated} legacy auth-state rows at rest`);
    return migrated;
}
