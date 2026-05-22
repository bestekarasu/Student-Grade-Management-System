import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const database = process.env.MYSQL_DATABASE || 'student_grade_management';

if (!/^[a-zA-Z0-9_]+$/.test(database)) {
  throw new Error('MYSQL_DATABASE may only contain letters, numbers, and underscores.');
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true
});

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await connection.query(`USE \`${database}\``);

const schema = await fs.readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
const seed = await fs.readFile(path.join(root, 'db', 'seed.sql'), 'utf8');

await connection.query(schema);
await connection.query(seed);
await connection.end();

console.log(`Database "${database}" is ready with demo data.`);
