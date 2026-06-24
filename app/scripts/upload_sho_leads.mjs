// One-off: upload "Sho Lead Sheet.csv" into prod CRM. Group = one per brand.
// Contacts upserted by email; tags = [contactType, title], UNIONed with any existing tags.
// Skipped: no-email or shared-placeholder-email rows (reported, sourced later).
// Run: node --env-file=.env.local scripts/upload_sho_leads.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const COMPANIES = [
  { company: 'Bummer', rows: [
    { type: 'Founder', name: 'Sulay Lavsi', title: 'Founder', linkedin: 'https://www.linkedin.com/in/sulaylavsi', email: 'sulay@bummer.in' },
    { type: 'POC', name: 'Hetashri Thaker', title: 'Assistant Growth Manager', linkedin: 'https://www.linkedin.com/in/hetashri-thaker', email: 'hetashri@bummer.in' },
  ]},
  { company: 'Beyond Snack', rows: [
    { type: 'Founder', name: 'Manas Madhu', title: 'Co-Founder & MD', linkedin: 'https://www.linkedin.com/in/manasmadhu', email: 'manas@beyondsnack.in' },
    { type: 'POC', name: 'Akanksha Goel', title: 'Brand Lead', linkedin: 'https://www.linkedin.com/in/akanksha-goel-45608279', email: 'akanksha@beyondsnack.in' },
    { type: 'POC', name: 'Rashmi Sasidharan', title: 'Marketing Manager', linkedin: 'https://www.linkedin.com/in/rashmi-sasidharan-5774b586', email: 'rashmi@beyondsnack.in' },
  ]},
  { company: 'Namhya Foods', rows: [
    { type: 'Founder', name: 'Ridhima Arora', title: 'Founder', linkedin: '', email: 'ridhima@namhyafoods.com' },
  ]},
  { company: 'Auli Lifestyle', rows: [
    { type: 'Founder', name: 'Aishwarya Biswas', title: 'Founder', linkedin: 'https://www.linkedin.com/in/ashbiswas', email: 'aishwarya@aulilifestyle.com' },
    { type: 'POC', name: 'Rochisnu Ghosh', title: 'Brand Executive (PR & Influencer)', linkedin: 'https://www.linkedin.com/in/rochisnu-ghosh-065642245', email: 'ghoshrochisnu@aulilifestyle.com' },
  ]},
  { company: 'Skippi Ice Pops', rows: [
    { type: 'Founder', name: 'Ravi Kabra', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/kabraravi', email: 'ravi@skippi.in' },
  ]},
  { company: 'Get-A-Whey', rows: [
    { type: 'Founder', name: 'Pashmi Shah', title: 'Co-Founder', linkedin: '', email: 'jash@getawhey.com' },
  ]},
  { company: 'Hammer Lifestyle', rows: [
    { type: 'Founder', name: 'Rohit Nandwani', title: 'Founder', linkedin: 'https://www.linkedin.com/in/rohit-nandwani-19a76189', email: 'rohit@ringtelmarketing.com' },
  ]},
  { company: 'Wakao Foods', rows: [
    { type: 'Founder', name: 'Sairaj Dhond', title: 'Founder & CEO', linkedin: 'https://www.linkedin.com/in/sairajdhondfounderwakaofoods', email: 'sairaj@wakaofoods.com' },
  ]},
  { company: 'PawsIndia', rows: [
    { type: 'Founder', name: 'Priyam Singh', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/priyam-singh-1ab61614b', email: 'priyam@pawsindia.com' },
  ]},
  { company: 'Nuutjob', rows: [
    { type: 'Founder', name: 'Ananya Maloo', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/ananya-maloo-524a88149', email: 'ananya@nuutjob.com' },
  ]},
  { company: 'Pee Safe', rows: [
    { type: 'Founder', name: 'Vikas Bagaria', title: 'Founder & CEO', linkedin: 'https://www.linkedin.com/in/vikkivik', email: 'vikas@peesafe.com' },
    { type: 'POC', name: 'Nitpreet Kaur', title: 'Head of Marketing', linkedin: 'https://www.linkedin.com/in/nitpreetchawla', email: 'nitpreet@peesafe.com' },
    { type: 'POC', name: 'Veronica Singh', title: 'Influencer Marketing Specialist', linkedin: 'https://www.linkedin.com/in/veronica-singh-7a007620a', email: 'influencer@peesafe.com' },
    { type: 'POC', name: 'Muskaan Gangwal', title: 'Brand Manager', linkedin: 'https://www.linkedin.com/in/muskaangangwal', email: 'muskaan.gangwal@peesafe.com' },
  ]},
  { company: 'Snitch', rows: [
    { type: 'Founder', name: 'Siddharth Dungarwal', title: 'Founder & Director', linkedin: 'https://www.linkedin.com/in/siddharthrdungarwal', email: 'sid@snitch.com' },
    { type: 'POC', name: 'Chetan Siyal', title: 'Founding Member & CMO', linkedin: 'https://www.linkedin.com/in/chetan-siyal-299b6830', email: 'chetan@snitch.com' },
    { type: 'POC', name: 'Manish Thanvi', title: 'Head of Brand', linkedin: 'https://www.linkedin.com/in/thisis88', email: 'manish.t@snitch.com' },
    { type: 'POC', name: 'Aahna Prakash', title: 'Influencer Marketing Executive', linkedin: 'https://www.linkedin.com/in/aahna-prakash-a3239336a', email: 'aahna.p@snitch.com' },
  ]},
  { company: 'House of Chikankari', rows: [
    { type: 'Founder', name: 'Aakriti Rawal', title: 'Founder', linkedin: 'https://www.linkedin.com/in/aakritirawal', email: 'aakriti.rawal@houseofchikankari.in' },
    { type: 'POC', name: 'Arunima Mukherjee', title: 'Asst. Brand Manager', linkedin: 'https://www.linkedin.com/in/arunima-mukherjee-638575215', email: 'arunima.mukherjee@houseofchikankari.in' },
    { type: 'POC', name: 'Mohit Sharma', title: 'Growth Manager', linkedin: 'https://www.linkedin.com/in/mohitsharmanoni', email: 'mohit.sharma@houseofchikankari.in' },
  ]},
  { company: 'Paradyes', rows: [
    { type: 'Founder', name: 'Yushika Jolly', title: 'Founder & CEO', linkedin: 'https://www.linkedin.com/in/yushikajolly', email: 'yushika@birdsofparadyes.com' },
    { type: 'POC', name: 'Sasha Figueiredo', title: 'Community Manager', linkedin: 'https://www.linkedin.com/in/sasha-figueiredo-a0b5a4168', email: 'sasha@birdsofparadyes.com' },
    { type: 'POC', name: 'Jaishil Ruparel', title: 'CX & Community', linkedin: 'https://www.linkedin.com/in/jaishil-ruparel', email: 'jaishil.ruparel@birdsofparadyes.com' },
  ]},
  { company: 'Avimee Herbal', rows: [
    { type: 'Founder', name: 'RK Choudhary', title: 'Founder', linkedin: '', email: 'rk@avimeeherbal.com' },
  ]},
  { company: 'Blue Tea', rows: [
    { type: 'Founder', name: 'Nitesh Singh', title: 'CEO & Co-Founder', linkedin: 'https://www.linkedin.com/in/nitesh-singh-blue-tea-guy-182020220', email: 'nitesh@bluetea.co.in' },
  ]},
  { company: 'Zoff Spices', rows: [
    { type: 'Founder', name: 'Akash Agrawal', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/akash-agrawal-184a7718', email: 'akash@zofffoods.com' },
    { type: 'POC', name: 'Meher Ahluwalia', title: 'Head of Marketing', linkedin: 'https://www.linkedin.com/in/meher-ahluwalia', email: 'meher.ahluwalia@zofffoods.com' },
    { type: 'POC', name: 'Divit Modi', title: 'Performance Marketing Manager', linkedin: 'https://www.linkedin.com/in/divit-modi-0150a716a', email: 'divit@zofffoods.com' },
  ]},
  { company: 'Hoovu Fresh', rows: [
    { type: 'Founder', name: 'Rhea Karuturi', title: 'Co-Founder & CTO', linkedin: 'https://www.linkedin.com/in/rhea-karuturi', email: 'rhea@hoovufresh.com' },
    { type: 'POC', name: 'Srinivasan K', title: 'Sales Marketing Manager', linkedin: 'https://www.linkedin.com/in/srinivasan-k-baa75125b', email: 'srinivasan@rosebazaar.in' },
  ]},
  { company: 'ManeTain', rows: [
    { type: 'Founder', name: 'Yuba Habeeb', title: 'Founder', linkedin: '', email: 'yuba@manetain.com' },
  ]},
  { company: 'Flatheads', rows: [
    { type: 'Founder', name: 'Ganesh Balakrishnan', title: 'Founder', linkedin: 'https://www.linkedin.com/in/ganeshbalakrishnan', email: 'ganesh@flatheads.in' },
  ]},
  { company: 'Ghar Soaps', rows: [
    { type: 'Founder', name: 'Sayyam Jain', title: 'Founder', linkedin: 'https://www.linkedin.com/in/sayyam-jain-80a984182', email: 'sayyam@gharsoaps.in' },
  ]},
  { company: 'Nestroots', rows: [
    { type: 'Founder', name: 'Chhavi Singh', title: 'Founder', linkedin: 'https://www.linkedin.com/in/chhavi-singh-68877223', email: 'chhavi@nestroots.com' },
    { type: 'POC', name: 'Palak Bhatia', title: 'Marketing Manager (Brand)', linkedin: 'https://www.linkedin.com/in/palak-bhatia-224796207', email: 'palak.bhatia@nestroots.com' },
  ]},
  { company: 'Gulabo Jaipur', rows: [
    { type: 'Founder', name: 'Kanika Agarwal', title: 'Founder', linkedin: '', email: 'kanika@gulabojaipur.com' },
  ]},
  { company: 'AdilQadri', rows: [
    { type: 'Founder', name: 'Adil Qadri', title: 'Founder', linkedin: 'https://www.linkedin.com/in/adilqadritheceo', email: 'adil@adilqadri.com' },
  ]},
  { company: 'Arata', rows: [
    { type: 'Founder', name: 'Dhruv Bhasin', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/dhruv-bhasin-906b4438', email: 'dhruv.bhasin@arata.in' },
    { type: 'POC', name: 'Kushagra Singh', title: 'Creative & Content Head', linkedin: 'https://www.linkedin.com/in/kushagra8s', email: 'kushagra@arata.in' },
  ]},
  { company: 'Nasher Miles', rows: [
    { type: 'Founder', name: 'Lokesh Daga', title: 'Co-Founder & Director', linkedin: 'https://www.linkedin.com/in/lokesh-daga-31173a10', email: 'lokesh@nashermiles.com' },
    { type: 'POC', name: 'Shruti Daga', title: 'Co-founder & Head of Marketing', linkedin: 'https://www.linkedin.com/in/shrutikedia', email: 'shruti@nashermiles.com' },
    { type: 'POC', name: 'Netish Sharma', title: 'Content & Community Manager', linkedin: 'https://www.linkedin.com/in/netishsharma23', email: 'netish@nashermiles.com' },
  ]},
  { company: 'Cosmix', rows: [
    { type: 'Founder', name: 'Vibha Harish', title: 'Founder', linkedin: 'https://www.linkedin.com/in/vibha-harish-cosmix', email: 'vibha@cosmix.in' },
    { type: 'POC', name: 'Joanesca Machado', title: 'Head of Brand', linkedin: 'https://www.linkedin.com/in/joanesca-machado-9475b887', email: 'joanesca@cosmix.in' },
  ]},
  { company: 'Koparo', rows: [
    { type: 'Founder', name: 'Simran Khara', title: 'Founder', linkedin: 'https://www.linkedin.com/in/simran-khara-1a411b18', email: 'simran@koparoclean.com' },
    { type: 'POC', name: 'Simran Chadha', title: 'Head of Content & Brand Marketing', linkedin: 'https://www.linkedin.com/in/simran-chadha-0366001ab', email: 'simranchadha@koparo.in' },
    { type: 'POC', name: 'Saanvi Srivastava', title: "Founder's Office (Brand & Content)", linkedin: 'https://www.linkedin.com/in/saanvi-sri', email: 'saanvi@koparo.in' },
  ]},
  { company: 'Wiselife', rows: [
    { type: 'Founder', name: 'Prateek Kedia', title: 'Founder', linkedin: 'https://www.linkedin.com/in/prateek-kedia-079b59158', email: 'prateek.kedia@wiselife.in' },
  ]},
  { company: 'Allter', rows: [
    { type: 'Founder', name: 'Aritra Basu', title: 'Founder', linkedin: '', email: 'aritra@allter.in' },
  ]},
  { company: 'A Toddler Thing', rows: [
    { type: 'Founder', name: 'Manasi Vora', title: 'Founder', linkedin: '', email: 'manasi@atoddlerthing.com' },
  ]},
  { company: 'The Bear House', rows: [
    { type: 'Founder', name: 'Harsh Somaiya', title: 'Co-Founder', linkedin: 'https://www.linkedin.com/in/harsh-somaiya-a0706788', email: 'harsh@thebearhouse.com' },
    { type: 'POC', name: 'Mayuri Samad', title: 'Influencer Marketing Manager', linkedin: 'https://www.linkedin.com/in/mayuri-samad-653a59231', email: 'mayuri.samad@thebearhouse.com' },
    { type: 'POC', name: 'Rohit Prasad', title: 'Brand Head', linkedin: 'https://www.linkedin.com/in/rohitkantprasad', email: 'rohit@thebearhouse.com' },
  ]},
  { company: 'BurgerBae', rows: [
    { type: 'Founder', name: 'Rohan Kashyap', title: 'Founder', linkedin: 'https://www.linkedin.com/in/rohan-kashyap-8b242582', email: 'rohan@burgerbae.in' },
  ]},
  { company: 'FAE Beauty', rows: [
    { type: 'Founder', name: 'Karishma Kewalramani', title: 'Founder', linkedin: 'https://www.linkedin.com/in/karishma-kewalramani-2219b177', email: 'karishma@faebeauty.in' },
  ]},
  { company: 'Born Good', rows: [
    { type: 'Founder', name: 'Mohit Belani', title: 'Founder', linkedin: '', email: 'mohit@borngood.in' },
  ]},
  { company: 'Ugees', rows: [
    { type: 'Founder', name: 'Rashi Narang', title: 'Founder', linkedin: '', email: 'rashi@ugees.com' },
  ]},
  { company: 'Confect', rows: [
    { type: 'Founder', name: 'Gauri Varma', title: 'Founder', linkedin: '', email: 'gauri@confect.in' },
  ]},
  { company: 'Culture Circle', rows: [
    { type: 'Founder', name: 'Ayush Maheshwari', title: 'Founder', linkedin: '', email: 'ayush@culturecircle.in' },
  ]},
]

async function findOrCreateGroup(name) {
  const { data: existing, error: selErr } = await supabase
    .from('contact_groups').select('id').eq('name', name).limit(1)
  if (selErr) throw selErr
  if (existing && existing.length) return existing[0].id
  const { data: created, error: insErr } = await supabase
    .from('contact_groups')
    .insert({ name, source_filename: 'Sho Lead Sheet.csv' })
    .select('id').single()
  if (insErr) throw insErr
  return created.id
}

async function main() {
  // Pre-fetch existing tags for every email we'll touch, so we can union (not clobber).
  const allEmails = COMPANIES.flatMap((c) => c.rows.map((r) => r.email.trim().toLowerCase()))
  const { data: existingContacts, error: exErr } = await supabase
    .from('contacts').select('email, tags').in('email', allEmails)
  if (exErr) throw exErr
  const tagMap = new Map(existingContacts.map((c) => [c.email, c.tags || []]))

  let groupCount = 0, upserted = 0
  for (const { company, rows } of COMPANIES) {
    const groupId = await findOrCreateGroup(company)
    groupCount++
    const payload = rows.map((r) => {
      const email = r.email.trim().toLowerCase()
      const wanted = [r.type, r.title].filter(Boolean)
      const merged = Array.from(new Set([...(tagMap.get(email) || []), ...wanted]))
      return { name: r.name, email, company, linkedin: r.linkedin || null, tags: merged, group_id: groupId }
    })
    const { data, error } = await supabase
      .from('contacts').upsert(payload, { onConflict: 'email' }).select('id')
    if (error) throw error
    upserted += data.length
    console.log(`  ${company}: ${data.length}`)
  }
  console.log(`\nDone. ${groupCount} groups touched, ${upserted} contacts upserted.`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
