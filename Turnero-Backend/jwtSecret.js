require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'turnero-dev-secret';

module.exports = { JWT_SECRET };
