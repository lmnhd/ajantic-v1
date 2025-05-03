import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

declare global {
    // Use a type alias for the singleton return type for clarity
    type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>
    var prisma: PrismaClientSingleton | undefined
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

// Remove the explicit PrismaClient type annotation to allow inference of the extended type
export const db = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = db
}

// Export for backwards compatibility - This also benefits from the inferred type
export const prisma = db