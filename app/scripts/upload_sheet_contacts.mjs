// One-off: upload the "companies / POC" sheet into prod CRM.
// Groups = one per company. Contacts upserted by email. Title + bucket -> tags.
// Run: node --env-file=app/.env.local scripts/upload_sheet_contacts.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// company -> { bucket, contacts: [{ name, title, linkedin, email }] }
// Contacts without an email are intentionally omitted (sourced later).
const COMPANIES = [
  { company: 'newme', bucket: 'Mid-market', contacts: [
    { name: 'Dhwani Shah', title: 'Founding Member - Influencer Marketing & Partnerships', linkedin: 'https://www.linkedin.com/in/dhwani-shah-aa2249188', email: 'dhwani@newme.asia' },
    { name: 'Saumya Pandey', title: 'Marketing & Community Lead', linkedin: 'https://www.linkedin.com/in/saumya-pandey-4a5363169', email: 'saumya.pandey@newme.asia' },
  ]},
  { company: 'Liquid I.V. India', bucket: 'Multinational (HUL)', contacts: [
    { name: 'Guntas Randhawa', title: 'India Head VMS Division HUL / Head of Liquid I.V. India', linkedin: 'https://in.linkedin.com/in/guntas-randhawa-9559b611', email: 'guntas.randhawa@unilever.com' },
    { name: 'Priyanshu Jain', title: 'Brand CSP Executive - Liquid I.V.', linkedin: 'https://www.linkedin.com/in/priyanshujain22', email: 'priyanshu.jain@unilever.com' },
  ]},
  { company: 'Paradyes', bucket: 'Small/startup', contacts: [
    { name: 'Yushika Jolly', title: 'Founder & CEO', linkedin: 'https://www.linkedin.com/in/yushikajolly', email: 'yushika@birdsofparadyes.com' },
    { name: 'Siddharth Raghuvanshi', title: 'Co-Founder & COO', linkedin: 'https://www.linkedin.com/in/siddharth-raghuvanshi-22b9809a', email: 'raghuvanshi@birdsofparadyes.com' },
    { name: 'Janki Solanki', title: 'Brand Executive', linkedin: 'https://www.linkedin.com/in/janki-solanki-72b017222', email: 'janki.solanki@birdsofparadyes.com' },
  ]},
  { company: 'Bare Anatomy (Innovist)', bucket: "Multinational (L'Oreal-acquired)", contacts: [
    { name: 'Ekansh Mathur', title: 'Manager - Influencer Marketing', linkedin: 'https://www.linkedin.com/in/ekanshmathur', email: 'ekansh@onestolabs.com' },
    { name: 'Sagar Sharma', title: 'Associate Manager - Influencer Marketing', linkedin: 'https://www.linkedin.com/in/sagar-sharma-2ba10a1b3', email: 'sagarsharma@bareanatomy.com' },
    { name: 'Sifat Khurana', title: 'Co-Founder & CMO', linkedin: 'https://www.linkedin.com/in/sifatkhurana', email: 'sifat@bareanatomy.com' },
  ]},
  { company: 'Bonkers Corner', bucket: 'Mid-market', contacts: [
    { name: 'Prabhu Shetty', title: 'Head of Marketing & Retail', linkedin: 'https://www.linkedin.com/in/prabhushetty', email: 'prabhu.shetty@bonkerscorner.com' },
    { name: 'Nikhil Gaonkar', title: 'Marketing Lead - Brand & Growth', linkedin: 'https://www.linkedin.com/in/nikhil-gaonkar-198598129', email: 'nikhil.gaonkar@bonkerscorner.com' },
    { name: 'Disha Pandya', title: 'Influencer Marketing Executive', linkedin: 'https://www.linkedin.com/in/disha-pandya-58b73226b', email: 'disha.pandya@bonkerscorner.com' },
    { name: 'Shubham Gupta', title: '', linkedin: 'https://www.linkedin.com/in/shubham-gupta-335437211/', email: 'shubham.gupta@bonkerscorner.com' },
  ]},
  { company: 'Urban Monkey', bucket: 'Small/bootstrapped', contacts: [
    { name: 'Yash Gangwal', title: 'Founder', linkedin: 'https://www.linkedin.com/in/yash-gangwal-8a630b75', email: 'yash@urbanmonkey.com' },
  ]},
  { company: 'Freakins', bucket: 'Small (funded - ICP exclude)', contacts: [
    { name: 'Shaan Shah', title: 'CMO & Co-Founder', linkedin: 'https://www.linkedin.com/in/shaan-shah', email: 'shaan@freakins.com' },
    { name: 'Puneet Sehgal', title: 'CEO & Co-Founder', linkedin: 'https://www.linkedin.com/in/puneet-sehgal-b1027011', email: 'puneet@freakins.com' },
  ]},
  { company: 'The Souled Store', bucket: 'Large', contacts: [
    { name: 'Rosheen Dhar', title: 'Manager - Brand Marketing', linkedin: 'https://www.linkedin.com/in/rosheendhar1220', email: 'rosheen.dhar@thesouledstore.com' },
    { name: 'Pranav Nambiar', title: 'Marketing Manager (Growth)', linkedin: 'https://www.linkedin.com/in/pranav-nambiar-356162190', email: 'pranav.nambiar@thesouledstore.com' },
  ]},
  { company: 'Snitch', bucket: 'Mid-market', contacts: [
    { name: 'Manish Thanvi', title: 'Head of Brand', linkedin: 'https://www.linkedin.com/in/thisis88', email: 'manish.t@snitch.com' },
    { name: 'Chetan Siyal', title: 'Founding Member & CMO', linkedin: 'https://www.linkedin.com/in/chetan-siyal-299b6830', email: 'chetan@snitch.com' },
    { name: 'Aahna Prakash', title: 'Influencer Marketing Executive', linkedin: 'https://www.linkedin.com/in/aahna-prakash-a3239336a', email: 'aahna.p@snitch.com' },
  ]},
  { company: 'Oyela', bucket: 'Small', contacts: [
    { name: 'Rahul Gope', title: 'Co-Founder & CEO', linkedin: 'https://www.linkedin.com/in/rahulgope', email: 'rahul.gope@oyela.in' },
    { name: 'Anjan Patel', title: 'Co-Founder & CTO', linkedin: 'https://www.linkedin.com/in/anjankumarpatel', email: 'anjan.k.patel@oyela.in' },
  ]},
  { company: 'Off Duty', bucket: 'Small', contacts: [
    { name: 'Madina Khan', title: 'Co-Founder & CMO (Marketing & Design)', linkedin: 'https://www.linkedin.com/in/madina-s-khan-913362295', email: 'madina@offduty.in' },
    { name: 'Shahbaaz Khan', title: 'Co-Founder & CEO', linkedin: 'https://www.linkedin.com/in/shahbaaz-khan-202650193', email: 'shahbaaz@offduty.in' },
  ]},
  { company: 'Bewakoof', bucket: 'Large (Aditya Birla-owned)', contacts: [
    { name: 'Khyati Singh', title: 'Social Media & Brand Marketing', linkedin: 'https://www.linkedin.com/in/khyati-singh-813419178', email: 'khyati.s@bewakoof.com' },
    { name: 'Manish Sharma', title: 'Marketing Lead (Brand)', linkedin: 'https://www.linkedin.com/in/manish11sharma', email: 'manish.s@bewakoof.com' },
    { name: 'Meenakshi J', title: 'Associate Manager - Brand & Campaign / Licensing', linkedin: 'https://www.linkedin.com/in/meenakshitj', email: 'meenakshi.tj@bewakoof.com' },
  ]},
  { company: 'wearADHD', bucket: 'Small', contacts: [
    { name: 'Ronit Singh', title: 'Co-Founder & Creative Director', linkedin: 'https://in.linkedin.com/in/ronit-singh-423a45109', email: 'ronit@wearadhd.com' },
  ]},
  { company: 'Savana', bucket: 'Mid-market (Urbanic)', contacts: [
    { name: 'Rahul Dayama', title: 'Co-Founder / Marketing Head', linkedin: 'https://uk.linkedin.com/in/clickerrahul', email: 'rahul@savana.com' },
  ]},
]

async function findOrCreateGroup(name) {
  const { data: existing, error: selErr } = await supabase
    .from('contact_groups').select('id').eq('name', name).limit(1)
  if (selErr) throw selErr
  if (existing && existing.length) return existing[0].id
  const { data: created, error: insErr } = await supabase
    .from('contact_groups')
    .insert({ name, source_filename: 'sheet:companies-poc' })
    .select('id').single()
  if (insErr) throw insErr
  return created.id
}

async function main() {
  let groupCount = 0, upserted = 0
  for (const { company, bucket, contacts } of COMPANIES) {
    const groupId = await findOrCreateGroup(company)
    groupCount++
    const rows = contacts.map((c) => ({
      name: c.name,
      email: c.email.trim().toLowerCase(),
      company,
      linkedin: c.linkedin || null,
      tags: [bucket, c.title].filter(Boolean),
      group_id: groupId,
    }))
    const { data, error } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'email' })
      .select('id, email')
    if (error) throw error
    upserted += data.length
    console.log(`  ${company}: group ${groupId.slice(0, 8)} <- ${data.length} contacts`)
  }
  console.log(`\nDone. ${groupCount} groups, ${upserted} contacts upserted.`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
