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

<p>Om from Blue here — sending this from a script, but reading replies by hand.</p>

<p>You're probably already using VS Code and paying way too much for Cursor or Claude credits.</p>

<p>You probably also want multi-file AI edits without spending $20/month.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">install our VS Code extension</a>, grab your key from <a href="${siteUrl}/console" style="color: #2563eb;">the console</a>, and ask it to write something. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'welcome_day3':
      return {
        subject: "Quick tip for Blue",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with your scheduled Day 3 nudge (I promise it gets useful).</p>

<p>You're probably writing boilerplate by hand or context-switching to browser ChatGPT.</p>

<p>You probably also want to trigger multi-file refactors right inside VS Code in 2 seconds.</p>

<p>So: select any code, hit <code>Ctrl+Shift+P</code>, and run <code>Blue: Edit Code</code>. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'welcome_day7':
      return {
        subject: "Still figuring out Blue?",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here. This email is automated, but I actually fix bugs based on what people reply to it.</p>

<p>You signed up a week ago.</p>

<p>You probably hit a weird edge case, forgot your key, or just got busy.</p>

<p>So: hit reply and tell me what sucked, or <a href="${siteUrl}/console" style="color: #2563eb;">grab your key</a> and give it another try. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'logged_in_no_install':
      return {
        subject: "One step left for Blue",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — yes, a bot sent this, but a human (me) reads the inbox.</p>

<p>You created a Blue account, but haven't made a single request yet.</p>

<p>You probably just got distracted before installing the extension.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">install the extension</a>, copy your key from <a href="${siteUrl}/console" style="color: #2563eb;">the console</a>, and try one prompt. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'signed_up_no_use':
      return {
        subject: "Quick question about your Blue key",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with an email triggered by a cron job, though I do read every response.</p>

<p>You generated an API key a while ago, but haven't used it to run any prompts yet.</p>

<p>You're probably still burning $20/month on Cursor out of habit.</p>

<p>So: <a href="vscode:extension/om-mali.blue-coding-assistant" style="color: #2563eb;">open VS Code</a>, paste your key, and ask Blue to build a feature for $1/mo. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'used_once_inactive':
      return {
        subject: "Blue has gotten a lot faster",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here. This is automated, but my inbox isn't.</p>

<p>You tried Blue 2 weeks ago, but haven't made any requests since.</p>

<p>We just pushed new model routing, faster multi-file context, and lower latency.</p>

<p>So: open VS Code and ask Blue to refactor something today. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'active_churned':
      return {
        subject: "Stopped using Blue?",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — writing via script, reading replies in person.</p>

<p>You used to code with Blue a lot, but stopped about a month ago.</p>

<p>You probably hit a bug we didn't know about or switched tools.</p>

<p>So: hit reply and tell me why you stopped, or fire up VS Code and test out the latest build. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'free_hitting_limits':
      return {
        subject: "Running low on Blue credits",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with a system alert wrapped in a chill email.</p>

<p>You're almost out of free Blue credits.</p>

<p>You probably want to keep coding without your AI assistant cutting off mid-file.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">top up credits</a> or upgrade to Blue Pro. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'free_very_active':
      return {
        subject: "You're using Blue a lot",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — automated email, genuine compliment.</p>

<p>You've been using Blue heavily on the free tier lately.</p>

<p>You probably want faster throughput, bigger context windows, and zero daily caps.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">check out Blue Pro</a> for $1/mo. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'expired_subscription':
      return {
        subject: "Your Blue plan expired",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here with an automated reminder from our billing system.</p>

<p>Your Blue subscription just expired.</p>

<p>Your keys, settings, and project history are all still intact.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">renew your plan</a> and keep building. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'pro_credits_low':
      return {
        subject: "Low Blue Pro balance",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — automated notification, but very practical.</p>

<p>Your Blue Pro credit balance is running low.</p>

<p>You probably don't want your VS Code inline edits pausing in the middle of a refactor.</p>

<p>So: <a href="${siteUrl}/console" style="color: #2563eb;">add credits to your wallet</a>. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'course_promotion':
      return {
        subject: "Building apps without writing code",
        html: wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — automated broadcast, but worth 30 seconds of your time.</p>

<p>You're already using AI to write code.</p>

<p>You probably also want to build full-stack apps end-to-end using autonomous AI agents.</p>

<p>So: check out our <a href="${siteUrl}/courses/create-software-without-code" style="color: #2563eb;">Vibe Coding Masterclass</a>. That's it.</p>

<p>Easy,</p>
        `, siteUrl)
      };

    case 'new_feature':
      return {
        subject: customSubject || "New in Blue",
        html: wrapEmail(customContent || `
<p>Hey there,</p>

<p>Om from Blue here with a quick product update.</p>

<p>We just pushed new updates and speed improvements to Blue.</p>

<p>So: update your VS Code extension and check out <a href="${siteUrl}/console" style="color: #2563eb;">the console</a>. That's it.</p>

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

<p>Easy,</p>
        `, siteUrl)
      };
  }
}
