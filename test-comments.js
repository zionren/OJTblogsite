const postgres = require('postgres');

const client = postgres({
  host: 'localhost', 
  port: 5432, 
  database: 'ojtblogger',
  username: 'ojtblogger_user', 
  password: 'ojtblogger_secure_password_2025'
});

async function checkComments() {
  try {
    const countResult = await client`SELECT COUNT(*) FROM comments`;
    console.log('Total comments:', countResult[0].count);
    
    const comments = await client`SELECT * FROM comments LIMIT 5`;
    console.log('Sample comments:', comments);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkComments();
