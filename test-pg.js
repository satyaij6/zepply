const { Client } = require('pg');

const run = async () => {
  const client = new Client({
    connectionString: "postgresql://postgres.irbvjxotwwhiymlehwpw:Q1sylvEKyLzfKMW2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
  });

  try {
    await client.connect();
    console.log("SUCCESS! Connected to Supabase Pooler");
    const res = await client.query('SELECT NOW()');
    console.log("Time query:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("CONNECTION ERROR:", err.message);
  }
};

run();
