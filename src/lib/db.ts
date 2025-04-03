import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

declare global {
    var prisma: ReturnType<typeof prismaClientSingleton> | undefined
}

const prismaClientSingleton = () => {
    return new PrismaClient({
        //log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    }).$extends(withAccelerate())
}

export const db: PrismaClient = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = db
}

// Export for backwards compatibility
export const prisma = db