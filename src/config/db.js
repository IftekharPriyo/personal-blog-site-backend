const prismaClient = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const { PrismaClient } = prismaClient;
const adapter = new PrismaPg(process.env.DATABASE_URL);

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const connectDB = async () => {
    try {
        await prisma.$connect();  
        console.log('Connected to the database successfully!');
    } catch (error) {
        console.error('Error connecting to the database:', error);
        process.exit(1); // Exit the process with an error code
    } 
};

const disconnectDB = async () => {
    try {
        await prisma.$disconnect();
        console.log('Disconnected from the database successfully!');
    }
    catch (error) {
        console.error('Error disconnecting from the database:', error);
    }   
};

module.exports = {
    prisma,
    connectDB,
    disconnectDB,
};

