// backend/sql/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME seed script — inserts sample farmers, crops, listings and services
// into your Neon PostgreSQL database.
//
// Run once:  node sql/seed.js
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const query = (text, params) => pool.query(text, params);

// ── Jhanjeri area coordinates (Mohali, Punjab) ────────────────────────────
// Slight offsets so each listing appears at a different point on the map
const LOCATIONS = [
  { lat: 30.7659, lng: 76.6584, address: 'Jhanjeri, Mohali, Punjab 140307' },
  { lat: 30.7720, lng: 76.6610, address: 'Sector 1, Jhanjeri, Mohali' },
  { lat: 30.7600, lng: 76.6540, address: 'Near Gurudwara, Jhanjeri, Mohali' },
  { lat: 30.7680, lng: 76.6650, address: 'Main Market, Jhanjeri, Mohali' },
  { lat: 30.7750, lng: 76.6500, address: 'Pind Jhanjeri, Mohali, Punjab' },
  { lat: 30.7630, lng: 76.6700, address: 'Village Road, Jhanjeri, Mohali' },
  { lat: 30.7700, lng: 76.6450, address: 'Kisan Colony, Mohali, Punjab' },
  { lat: 30.7580, lng: 76.6620, address: 'Near School, Jhanjeri, Mohali' },
];

const loc = (i) => LOCATIONS[i % LOCATIONS.length];

// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🌱 Starting seed...\n');

    // ── 1. Create sample users ───────────────────────────────────────────
    const passwordHash = await bcrypt.hash('password123', 12);

    const userInserts = [
      { name: 'Gurpreet Singh',   phone: '9876543210', trust: 4.5, completed: 12, reviews: 10 },
      { name: 'Harpreet Kaur',    phone: '9876543211', trust: 4.2, completed: 8,  reviews: 7  },
      { name: 'Balwinder Kumar',  phone: '9876543212', trust: 3.8, completed: 5,  reviews: 5  },
      { name: 'Manpreet Sandhu',  phone: '9876543213', trust: 4.7, completed: 20, reviews: 18 },
      { name: 'Sukhwinder Singh', phone: '9876543214', trust: 4.0, completed: 6,  reviews: 6  },
      { name: 'Rajwinder Kaur',   phone: '9876543215', trust: 3.5, completed: 3,  reviews: 4  },
    ];

    const userIds = [];
    for (const u of userInserts) {
      // Use ON CONFLICT so re-running seed does not crash on duplicate phone
      const r = await client.query(`
        INSERT INTO users
          (name, phone, password_hash, role, address, lat, lng,
           trust_score, completed_transactions, total_review_score, review_count, is_verified)
        VALUES ($1,$2,$3,'both',$4,$5,$6,$7,$8,$9,$10,TRUE)
        ON CONFLICT (phone) DO UPDATE
          SET trust_score = EXCLUDED.trust_score
        RETURNING id
      `, [
        u.name, u.phone, passwordHash,
        LOCATIONS[0].address, LOCATIONS[0].lat, LOCATIONS[0].lng,
        u.trust, u.completed, u.reviews * 4, u.reviews,
      ]);
      userIds.push(r.rows[0].id);
    }
    console.log(`✅ ${userIds.length} users created`);
    console.log('   Login with any phone: password123\n');

    // ── 2. Crops ─────────────────────────────────────────────────────────
    const crops = [
      // Grains
      { farmer: 0, name: 'Basmati Rice',     category: 'grain',     price: 3500, unit: 'quintal', qty: 50,  desc: 'Premium Basmati from Punjab fields. Long grain, excellent aroma. Freshly harvested.' },
      { farmer: 1, name: 'Wheat (HD-2967)',   category: 'grain',     price: 2200, unit: 'quintal', qty: 100, desc: 'High-yielding HD-2967 wheat variety. Suitable for chapati and flour milling.' },
      { farmer: 2, name: 'Yellow Mustard',    category: 'grain',     price: 5200, unit: 'quintal', qty: 30,  desc: 'Fresh yellow mustard. Oil content 42%. Pesticide-free cultivation.' },
      { farmer: 3, name: 'Maize (Corn)',      category: 'grain',     price: 1800, unit: 'quintal', qty: 80,  desc: 'Hybrid maize variety. Good for poultry feed and starch industry.' },
      // Vegetables
      { farmer: 0, name: 'Tomato',            category: 'vegetable', price: 25,   unit: 'kg',      qty: 500, desc: 'Fresh red tomatoes. Harvested daily. Good for retail and wholesale.' },
      { farmer: 1, name: 'Onion (Red)',        category: 'vegetable', price: 18,   unit: 'kg',      qty: 300, desc: 'Red onion from Mohali farms. Dry and well-stored. Shelf life 2 months.' },
      { farmer: 4, name: 'Potato (Kufri)',     category: 'vegetable', price: 12,   unit: 'kg',      qty: 1000,desc: 'Kufri Jyoti potato variety. Clean, sorted, 40-60mm size.' },
      { farmer: 5, name: 'Cauliflower',        category: 'vegetable', price: 20,   unit: 'kg',      qty: 200, desc: 'White cauliflower, firm heads. Chemical-free cultivation in Mohali.' },
      { farmer: 2, name: 'Spinach (Palak)',    category: 'vegetable', price: 15,   unit: 'kg',      qty: 150, desc: 'Fresh organic spinach. Harvested morning, delivered same day.' },
      // Fruits
      { farmer: 3, name: 'Kinnow (Mandarin)', category: 'fruit',     price: 35,   unit: 'kg',      qty: 400, desc: 'Sweet Kinnow from Punjab. High juice content. Grade A, 60+ mm size.' },
      { farmer: 4, name: 'Guava (Allahabad)', category: 'fruit',     price: 40,   unit: 'kg',      qty: 200, desc: 'White guava, sweet and crispy. Good for direct consumption and juice.' },
      { farmer: 5, name: 'Mango (Dusehri)',   category: 'fruit',     price: 80,   unit: 'kg',      qty: 100, desc: 'Lucknow Dusehri mango. Fibreless, sweet pulp. Pre-order for next season.' },
      // Legumes
      { farmer: 0, name: 'Chickpea (Chana)',  category: 'legume',    price: 6500, unit: 'quintal', qty: 20,  desc: 'Desi chana. Bold size, good protein. Suitable for direct sale and processing.' },
      { farmer: 1, name: 'Green Peas',         category: 'legume',    price: 45,   unit: 'kg',      qty: 300, desc: 'Fresh green peas. Sweet taste. Available December to February.' },
      { farmer: 2, name: 'Moong Dal (Green)', category: 'legume',    price: 8500, unit: 'quintal', qty: 15,  desc: 'Green Moong. Clean, machine-sorted. 98% purity. Good germination.' },
      // Spices
      { farmer: 3, name: 'Red Chilli',         category: 'spice',     price: 120,  unit: 'kg',      qty: 50,  desc: 'Dry red chilli. Medium heat. Good colour. Sun dried naturally.' },
      { farmer: 4, name: 'Turmeric (Haldi)',   category: 'spice',     price: 95,   unit: 'kg',      qty: 80,  desc: 'Raw turmeric from Punjab. High curcumin content. Finger variety.' },
      { farmer: 5, name: 'Coriander Seeds',    category: 'spice',     price: 75,   unit: 'kg',      qty: 60,  desc: 'Clean coriander seeds. Good aroma. Suitable for spice grinding.' },
    ];

    let cropCount = 0;
    for (const c of crops) {
      const l = loc(c.farmer);
      const harvest = new Date();
      harvest.setDate(harvest.getDate() - Math.floor(Math.random() * 30));

      await client.query(`
        INSERT INTO crops
          (farmer_id, name, category, price, unit, quantity,
           description, harvest_date, address, lat, lng, is_active, views)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12)
        ON CONFLICT DO NOTHING
      `, [
        userIds[c.farmer], c.name, c.category, c.price, c.unit, c.qty,
        c.desc, harvest.toISOString().slice(0, 10),
        l.address, l.lat, l.lng,
        Math.floor(Math.random() * 50) + 5,
      ]);
      cropCount++;
    }
    console.log(`✅ ${cropCount} crops inserted\n`);

    // ── 3. Listings (land & warehouse) ───────────────────────────────────
    const listings = [
      {
        owner: 0, type: 'land', title: '5 Acre Irrigated Land – Jhanjeri',
        area: 5, area_unit: 'acres', rent: 8000, rent_per: 'month', min_duration: 6,
        amenities: ['irrigation', 'electricity', 'road_access'],
        desc: 'Fertile agricultural land with tubewell irrigation. Good soil quality. Road accessible. Ideal for wheat, rice, or vegetables.',
      },
      {
        owner: 1, type: 'land', title: '2 Acre Land for Lease – Mohali',
        area: 2, area_unit: 'acres', rent: 3500, rent_per: 'month', min_duration: 3,
        amenities: ['road_access'],
        desc: 'Plain land near Jhanjeri village. No major crops currently. Suitable for seasonal cultivation.',
      },
      {
        owner: 2, type: 'land', title: '10 Acre Farm Land – Kisan Colony',
        area: 10, area_unit: 'acres', rent: 15000, rent_per: 'month', min_duration: 12,
        amenities: ['irrigation', 'electricity', 'road_access', 'borewell'],
        desc: 'Large farm land with full irrigation setup. Borewell available. Electricity connection. Ideal for large-scale farming.',
      },
      {
        owner: 3, type: 'warehouse', title: 'Grain Storage Warehouse – Mohali',
        area: 5000, area_unit: 'sqft', rent: 12000, rent_per: 'month', min_duration: 1,
        amenities: ['electricity', 'security', 'loading_dock'],
        desc: '5000 sqft covered warehouse. Dry and ventilated. Security guard. Loading dock for trucks. Suitable for grain, vegetables, tools.',
      },
      {
        owner: 4, type: 'warehouse', title: 'Small Storage Unit – Jhanjeri',
        area: 1200, area_unit: 'sqft', rent: 4000, rent_per: 'month', min_duration: 1,
        amenities: ['electricity'],
        desc: 'Small storage unit for farm produce or equipment. Dry, clean space. Available immediately.',
      },
      {
        owner: 5, type: 'coldStorage', title: 'Cold Storage Facility – Mohali',
        area: 3000, area_unit: 'sqft', rent: 25000, rent_per: 'month', min_duration: 1,
        amenities: ['cold_storage', 'electricity', 'security', 'loading_dock'],
        desc: 'Temperature-controlled cold storage. -2°C to 15°C range. Ideal for potatoes, fruits, vegetables. 24/7 monitoring.',
      },
    ];

    let listingCount = 0;
    for (const li of listings) {
      const l = loc(li.owner + 2);
      await client.query(`
        INSERT INTO listings
          (owner_id, type, title, area, area_unit, rent, rent_per,
           amenities, description, address, lat, lng, is_available, min_duration)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13)
        ON CONFLICT DO NOTHING
      `, [
        userIds[li.owner], li.type, li.title, li.area, li.area_unit,
        li.rent, li.rent_per, li.amenities, li.desc,
        l.address, l.lat, l.lng, li.min_duration,
      ]);
      listingCount++;
    }
    console.log(`✅ ${listingCount} listings inserted\n`);

    // ── 4. Services ───────────────────────────────────────────────────────
    const services = [
      {
        provider: 0, name: 'Rotavator Service',
        category: 'equipment', price: 1200, price_per: 'acre',
        desc: 'Rotavator tilling service. New 2023 model. 4WD tractor. Available 6am-8pm. Covers Jhanjeri and nearby villages within 20km.',
      },
      {
        provider: 1, name: 'Tractor for Hire (55 HP)',
        category: 'equipment', price: 800, price_per: 'hour',
        desc: 'Sonalika 55HP tractor. Available for ploughing, levelling, and transportation. Experienced driver included.',
      },
      {
        provider: 2, name: 'Tempo Trolley Transport',
        category: 'transport', price: 2500, price_per: 'trip',
        desc: 'Tempo trolley for crop transportation. Capacity 5 tons. Covers Mohali, Ludhiana, Chandigarh. Available on booking.',
      },
      {
        provider: 3, name: 'Mini Truck (3 Ton)',
        category: 'transport', price: 1800, price_per: 'trip',
        desc: '3-ton mini truck for produce delivery. Covered vehicle. Same-day delivery within 50km. Available 7 days a week.',
      },
      {
        provider: 4, name: 'Farm Labor (Daily)',
        category: 'labor', price: 450, price_per: 'day',
        desc: 'Experienced farm workers available for harvesting, sowing, and general farm work. Group of 5-10 available. Contact for team booking.',
      },
      {
        provider: 5, name: 'Harvesting Team (Wheat/Rice)',
        category: 'labor', price: 3500, price_per: 'acre',
        desc: 'Complete harvesting service with combine harvester operator and 4 helpers. Wheat and paddy harvesting specialist.',
      },
      {
        provider: 0, name: 'Drip Irrigation Installation',
        category: 'irrigation', price: 15000, price_per: 'acre',
        desc: 'Complete drip irrigation setup. Includes pipes, drippers, filter, and control valve. 5-year warranty on materials.',
      },
      {
        provider: 1, name: 'Sprinkler System Setup',
        category: 'irrigation', price: 8000, price_per: 'acre',
        desc: 'Portable sprinkler irrigation system. Installation included. Suitable for wheat, vegetables, and orchards.',
      },
      {
        provider: 2, name: 'Pesticide Spraying (Drone)',
        category: 'other', price: 600, price_per: 'acre',
        desc: 'Agricultural drone spraying service. Covers 10 acres per hour. Precise application. Reduces pesticide usage by 30%.',
      },
      {
        provider: 3, name: 'Soil Testing Service',
        category: 'other', price: 500, price_per: 'acre',
        desc: 'Complete soil health test — pH, nitrogen, phosphorus, potassium, organic matter. Report in 48 hours with recommendations.',
      },
    ];

    let serviceCount = 0;
    for (const s of services) {
      const l = loc(s.provider + 1);
      await client.query(`
        INSERT INTO services
          (provider_id, name, category, price, price_per,
           description, address, lat, lng, is_active, image_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0)
        ON CONFLICT DO NOTHING
      `, [
        userIds[s.provider], s.name, s.category, s.price, s.price_per,
        s.desc, l.address, l.lat, l.lng,
      ]);
      serviceCount++;
    }
    console.log(`✅ ${serviceCount} services inserted\n`);

    // ── 5. Sample transactions ────────────────────────────────────────────
    // A few completed transactions so trust scores are visible
    const txData = [
      { buyer: 1, seller: 0, itemIdx: 0, itemType: 'crop', qty: 5,   amount: 17500 },
      { buyer: 2, seller: 1, itemIdx: 1, itemType: 'crop', qty: 10,  amount: 22000 },
      { buyer: 3, seller: 0, itemIdx: 4, itemType: 'crop', qty: 100, amount: 2500  },
      { buyer: 0, seller: 2, itemIdx: 0, itemType: 'service', qty: 3, amount: 3600 },
      { buyer: 1, seller: 3, itemIdx: 1, itemType: 'service', qty: 2, amount: 1600 },
    ];

    // Get crop ids
    const cropRows = await client.query(
      `SELECT id FROM crops WHERE farmer_id = ANY($1) ORDER BY created_at LIMIT 10`,
      [userIds]
    );
    const cropIds = cropRows.rows.map(r => r.id);

    // Get service ids
    const svcRows = await client.query(
      `SELECT id FROM services WHERE provider_id = ANY($1) ORDER BY created_at LIMIT 10`,
      [userIds]
    );
    const svcIds = svcRows.rows.map(r => r.id);

    for (const tx of txData) {
      const itemId = tx.itemType === 'crop'
        ? cropIds[tx.itemIdx] || cropIds[0]
        : svcIds[tx.itemIdx]  || svcIds[0];

      if (!itemId) continue;

      const txRes = await client.query(`
        INSERT INTO transactions
          (buyer_id, seller_id, item_id, item_type, quantity, amount, status, completed_at)
        VALUES ($1,$2,$3,$4,$5,$6,'completed', NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
        userIds[tx.buyer], userIds[tx.seller], itemId,
        tx.itemType, tx.qty, tx.amount,
      ]);

      if (!txRes.rows.length) continue;
      const txId = txRes.rows[0].id;

      // Buyer reviews seller
      await client.query(`
        INSERT INTO reviews
          (transaction_id, reviewer_id, reviewee_id, rating, comment, role)
        VALUES ($1,$2,$3,$4,$5,'buyer')
        ON CONFLICT (transaction_id, reviewer_id) DO NOTHING
      `, [
        txId, userIds[tx.buyer], userIds[tx.seller],
        4 + Math.floor(Math.random() * 2),
        'Good quality product, honest farmer. Would buy again!',
      ]);

      // Seller reviews buyer
      await client.query(`
        INSERT INTO reviews
          (transaction_id, reviewer_id, reviewee_id, rating, comment, role)
        VALUES ($1,$2,$3,$4,$5,'seller')
        ON CONFLICT (transaction_id, reviewer_id) DO NOTHING
      `, [
        txId, userIds[tx.seller], userIds[tx.buyer],
        4 + Math.floor(Math.random() * 2),
        'Reliable buyer. Paid on time. Recommended.',
      ]);
    }

    // Update completed_transactions count for sellers
    for (const id of userIds) {
      await client.query(`
        UPDATE users SET
          completed_transactions = (
            SELECT COUNT(*) FROM transactions
            WHERE seller_id = $1 AND status = 'completed'
          )
        WHERE id = $1
      `, [id]);
    }

    console.log(`✅ Sample transactions and reviews inserted\n`);

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════════════');
    console.log('✅ SEED COMPLETE');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('Test login credentials (any of these):');
    console.log('  Phone: 9876543210  Password: password123');
    console.log('  Phone: 9876543211  Password: password123');
    console.log('  Phone: 9876543212  Password: password123');
    console.log('');
    console.log('Data inserted:');
    console.log(`  Users    : ${userIds.length}`);
    console.log(`  Crops    : ${cropCount}`);
    console.log(`  Listings : ${listingCount}`);
    console.log(`  Services : ${serviceCount}`);
    console.log('');
    console.log('All locations are near Jhanjeri, Mohali, Punjab 140307');
    console.log('═══════════════════════════════════════════════');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
