const cron = require('node-cron');
const db = require('./db');
const { generateBirthdayCard } = require('./cardGenerator');
const { sendBirthdayEmail } = require('./resendService');

/**
 * Checks for team members with birthdays today and sends their cards.
 */
async function triggerBirthdayCheck() {
  console.log(`[Cron] Running daily birthday check at ${new Date().toISOString()}...`);
  const settings = await db.getSettings();
  const todaysBirthdays = await db.getMembersWithBirthdayToday();

  console.log(`[Cron] Found ${todaysBirthdays.length} member(s) with birthday today.`);

  const results = [];
  for (const member of todaysBirthdays) {
    try {
      console.log(`[Cron] Processing birthday card for ${member.name} (${member.email})...`);
      const cardBuffer = await generateBirthdayCard({
        name: member.name,
        designation: member.designation,
        picture: member.picture,
        quote: settings.quote_text,
        logoUrl: settings.logo_url
      });

      const resendRes = await sendBirthdayEmail({ member, cardBuffer });
      results.push({ member: member.name, email: member.email, status: resendRes.status || 'success' });
    } catch (err) {
      console.error(`[Cron] Error creating/sending card for ${member.name}:`, err);
      results.push({ member: member.name, email: member.email, status: `error: ${err.message}` });
    }
  }

  return {
    checkedCount: todaysBirthdays.length,
    results
  };
}

function initCron() {
  // Runs every day at 06:00 AM server time
  cron.schedule('0 6 * * *', async () => {
    console.log('[Cron] Daily scheduled birthday task triggered at 06:00 AM');
    await triggerBirthdayCheck();
  });
  console.log('[Cron] Daily cron job scheduled for 06:00 AM everyday.');
}

module.exports = { initCron, triggerBirthdayCheck };
