export interface EmailContent {
  subject: string;
  html: string;
}

export type CampaignType =
  | 'welcome_day1'
  | 'welcome_day3'
  | 'welcome_day7'
  | 'logged_in_no_install'
  | 'signed_up_no_use'
  | 'used_once_inactive'
  | 'active_churned'
  | 'free_hitting_limits'
  | 'free_very_active'
  | 'expired_subscription'
  | 'pro_credits_low'
  | 'course_promotion'
  | 'new_feature';

interface TemplateOptions {
  siteUrl: string;
  customSubject?: string;
  customContent?: string;
  creditsRemaining?: number;
}

function wrapEmail(body: string, siteUrl: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 15px; line-height: 1.7;">
${body}

  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.6;">
    --<br/>
    <strong style="color: #1a1a1a;">Om Karande</strong><br/>
    <span style="color: #4b5563;">Founder @ <a href="${siteUrl}" style="color: #2563eb; text-decoration: none;">Blue AI</a></span><br/>
    <span style="color: #9ca3af;">Pune, India</span>
  </p>
</div>
  `.trim();
}

export function getCampaignEmail(type: CampaignType, options: TemplateOptions): EmailContent {
  const { siteUrl, customSubject, customContent } = options;

  switch (type) {
    case 'welcome_day1':
      return {
        subject: "Welcome to Blue",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — sending this from an automated script, but reading replies by hand.</p>

<p>You're probably already using VS Code and paying way too much for Cursor or Claude credits.</p>

<p>You probably also want multi-file AI edits without spending $20/month.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">install our VS Code extension</a>, grab your key from <a href="${siteUrl}/console" style="color: #2563eb;">the console</a>, and ask it to write something. Takes less than 60 seconds.</p>

<p>Cheers,</p>
        `, siteUrl)
      };

    case 'welcome_day3':
      return {
        subject: "Quick tip for Blue",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with your Day 3 setup tip (I promise this one actually saves time).</p>

<p>You're probably writing repetitive boilerplate by hand or context-switching to ChatGPT in a browser tab.</p>

<p>You probably also want to trigger multi-file refactors right inside VS Code without leaving your keyboard.</p>

<p>So: select any code, hit <code>Ctrl+Shift+P</code>, and run <code>Blue: Edit Code</code>. Saves at least 15 minutes of typing today.</p>

<p>Happy coding,</p>
        `, siteUrl)
      };

    case 'welcome_day7':
      return {
        subject: "Still figuring out Blue?",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here. Yes this email was sent automatically, but I actually fix bugs based on what people reply to it.</p>

<p>You signed up a week ago.</p>

<p>You probably hit a weird edge case, forgot your key, or just got pulled into other projects.</p>

<p>So: hit reply and tell me what sucked, or <a href="${siteUrl}/console" style="color: #2563eb;">grab your key</a> and give it another spin. No hard feelings either way.</p>

<p>Best,</p>
        `, siteUrl)
      };

    case 'logged_in_no_install':
      return {
        subject: "One step left for Blue",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — a bot sent this email, but a real person (me) reads the inbox.</p>

<p>You created a Blue account, but haven't made a single request yet.</p>

<p>You probably just got distracted right before installing the extension.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">install the extension</a>, copy your key from <a href="${siteUrl}/console" style="color: #2563eb;">the console</a>, and run one prompt. Literally 3 clicks.</p>

<p>Let me know how it goes,</p>
        `, siteUrl)
      };

    case 'signed_up_no_use':
      return {
        subject: "Quick question about your Blue key",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with an email triggered by a cron job, though I do read every single response.</p>

<p>You generated an API key a while ago, but haven't used it to run any prompts yet.</p>

<p>You're probably still burning $20/month on Cursor out of pure muscle memory.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">open VS Code</a>, paste your key, and ask Blue to build a feature for $1. Worst case, you wasted 2 minutes. Best case, you saved $19.</p>

<p>Fair enough?</p>
        `, siteUrl)
      };

    case 'used_once_inactive':
      return {
        subject: "Blue has gotten a lot faster",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here. This message is automated, but my inbox is 100% human.</p>

<p>You tried Blue a couple of weeks ago, but haven't made any requests since.</p>

<p>We just pushed upgraded model routing, faster multi-file context building, and lower latency across the board.</p>

<p>So: open VS Code and ask Blue to refactor a file today. You'll notice the difference right away.</p>

<p>Welcome back,</p>
        `, siteUrl)
      };

    case 'active_churned':
      return {
        subject: "Stopped using Blue?",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — writing this template via code, checking replies in person.</p>

<p>You used to code with Blue regularly, but stopped about a month ago.</p>

<p>You probably ran into a bug we didn't spot or switched to another tool.</p>

<p>So: hit reply and tell me why you stopped, or open VS Code and test out the latest build. Even a single line of feedback helps.</p>

<p>Appreciate you,</p>
        `, siteUrl)
      };

    case 'free_hitting_limits':
      return {
        subject: "Running low on Blue credits",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with a system alert wrapped inside a friendly email.</p>

<p>You're almost out of free Blue credits.</p>

<p>You probably want to keep coding without your AI assistant cutting off in the middle of a file edit.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">top up credits</a> or upgrade to Blue Pro before your next prompt gets paused halfway.</p>

<p>Talk soon,</p>
        `, siteUrl)
      };

    case 'free_very_active':
      return {
        subject: "You're using Blue a lot",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — computer-sent email, genuine compliment.</p>

<p>You've been putting Blue through serious work on the free tier lately.</p>

<p>You probably want faster throughput, bigger context windows, and zero daily caps.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">check out Blue Pro</a> starting at just $1. You've earned the upgrade.</p>

<p>Keep building,</p>
        `, siteUrl)
      };

    case 'expired_subscription':
      return {
        subject: "Your Blue plan expired",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with a quick automated reminder from our system.</p>

<p>Your Blue subscription just expired.</p>

<p>Don't worry — your keys, settings, and project history are all safely saved.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">renew your plan</a> and pick up right where you left off.</p>

<p>Back to work,</p>
        `, siteUrl)
      };

    case 'pro_credits_low':
      return {
        subject: "Low Blue Pro balance",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — automated ping, but practical advice.</p>

<p>Your Blue Pro credit balance is running low.</p>

<p>You probably don't want your VS Code inline suggestions pausing mid-session while you're in the flow.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">add credits to your wallet</a>. Takes 10 seconds in the console.</p>

<p>Thanks for being a pro,</p>
        `, siteUrl)
      };

    case 'course_promotion':
      return {
        subject: "Building apps without writing code",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — automated broadcast, but worth 30 seconds of your attention.</p>

<p>You're already using AI to speed up your coding.</p>

<p>You probably also want to build full-stack apps end-to-end using autonomous AI agents.</p>

<p>So: check out our <a href="${siteUrl}/courses/create-software-without-code" style="color: #2563eb;">Vibe Coding Masterclass</a>. Check out the first module for free.</p>

<p>See you inside,</p>
        `, siteUrl)
      };

    case 'new_feature':
      return {
        subject: customSubject || "New in Blue: Auto safe images & fallbacks",
        html: wrapEmail(customContent || `
<p>Hey there,</p>

<p>Om from Blue here with an email that's automated, but doesn't pretend otherwise. I still read every reply though.</p>

<p>You're probably hunting down images for your project manually or watching code generation stall when a placeholder fails.</p>

<p>You probably also want Blue to grab safe, licensed photos automatically — or build custom fallback visuals on the fly without missing a beat.</p>

<p>So: update to <strong>v0.6.39</strong> in VS Code and run your prompt. That's it. (Blender 3D works right alongside it too).</p>

<p>Easy,</p>
        `, siteUrl)
      };

    default:
      return {
        subject: "Updates from Blue AI",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here.</p>

<p>Check out the latest updates on <a href="${siteUrl}/console" style="color: #2563eb;">Blue AI</a>.</p>

<p>Best,</p>
        `, siteUrl)
      };
  }
}
