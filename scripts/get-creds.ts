import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const conn = await prisma.integrationConnection.findFirst({ where: { type: 'TRELLO' } });
    if (!conn) return console.log('No trello conn');
    
    // Internal API running on 4000
    const response = await fetch(`http://localhost:4000/api/settings/integrations/secret?projectId=${conn.projectId}&type=TRELLO`, {
        headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY || 'dev-internal-api-key', 'content-type': 'application/json' },
    });
    const data = await response.json();
    console.log("BOARD_ID=" + conn.configJson.boardId);
    if (data.secret) {
        console.log("API_KEY=" + data.secret.apiKey);
        console.log("API_TOKEN=" + data.secret.token);
    } else {
        console.log("NO SECRET FOUND");
    }
}

main().finally(() => prisma.$disconnect());
