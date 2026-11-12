param([Parameter(Mandatory=$true)][string]$NodePath, [Parameter(Mandatory=$true)][string]$WranglerPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$names = @('BLUE_TASK_TICKET_SECRET','OPENROUTER_API_KEY','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN')
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Blue - Cloudflare secrets'
$form.ClientSize = New-Object System.Drawing.Size(740,620)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$intro = New-Object System.Windows.Forms.Label
$intro.SetBounds(20,15,700,50)
$intro.Text = 'Paste the six existing Vercel Production values below. Use Ctrl+V or each Paste button. Values stay masked and are sent only to your Blue Cloudflare Worker.'
$form.Controls.Add($intro)
$boxes = @{}
for ($i=0; $i -lt $names.Count; $i++) {
  $name = $names[$i]
  $top = 75 + $i*72
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $name
  $label.SetBounds(20,$top,680,20)
  $form.Controls.Add($label)
  $box = New-Object System.Windows.Forms.TextBox
  $box.SetBounds(20,($top+23),590,27)
  $box.UseSystemPasswordChar = $true
  $box.ShortcutsEnabled = $true
  $form.Controls.Add($box)
  $boxes[$name] = $box
  $paste = New-Object System.Windows.Forms.Button
  $paste.Text = 'Paste'
  $paste.SetBounds(625,($top+21),90,30)
  $paste.Tag = $box
  $paste.Add_Click({ param($sender,$eventArgs)
    try { $sender.Tag.Text = [System.Windows.Forms.Clipboard]::GetText().Trim() }
    catch { [System.Windows.Forms.MessageBox]::Show('Clipboard is unavailable. Try Ctrl+V in the field.') | Out-Null }
  })
  $form.Controls.Add($paste)
}
$status = New-Object System.Windows.Forms.Label
$status.SetBounds(20,515,690,42)
$status.Text = 'No values are printed or saved to a file. Nothing uploads until you click Upload.'
$form.Controls.Add($status)
$upload = New-Object System.Windows.Forms.Button
$upload.Text = 'Upload to Cloudflare'
$upload.SetBounds(20,565,220,35)
$form.Controls.Add($upload)
$close = New-Object System.Windows.Forms.Button
$close.Text = 'Close'
$close.SetBounds(620,565,95,35)
$close.Add_Click({ $form.Close() })
$form.Controls.Add($close)
$upload.Add_Click({
  $values = @{}
  foreach ($name in $names) {
    $value = $boxes[$name].Text.Trim()
    if (!$value -or $value -match '[\r\n]') {
      $status.Text = "Paste the complete value for $name, without line breaks."
      $boxes[$name].Focus()
      return
    }
    $values[$name] = $value
  }
  if ($values['BLUE_TASK_TICKET_SECRET'].Length -lt 32) { $status.Text = 'The task-ticket secret needs at least 32 characters.'; return }
  foreach ($name in @('NEXT_PUBLIC_SUPABASE_URL','UPSTASH_REDIS_REST_URL')) {
    if ($values[$name] -notmatch '^https://[^\s]+$') { $status.Text = "$name must be the HTTPS URL."; return }
  }
  $upload.Enabled = $false
  $close.Enabled = $false
  $status.Text = 'Uploading to blue-inference-proxy. Please wait...'
  [System.Windows.Forms.Application]::DoEvents()
  try {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $NodePath
    $start.Arguments = '"' + $WranglerPath + '" secret bulk --config "' + (Join-Path $PSScriptRoot 'wrangler.jsonc') + '"'
    $start.WorkingDirectory = $PSScriptRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['WRANGLER_SEND_METRICS'] = 'false'
    $child = [System.Diagnostics.Process]::Start($start)
    $child.StandardInput.WriteLine(($values | ConvertTo-Json -Compress))
    $child.StandardInput.Close()
    $outputTask = $child.StandardOutput.ReadToEndAsync()
    $errorTask = $child.StandardError.ReadToEndAsync()
    while (!$child.WaitForExit(100)) { [System.Windows.Forms.Application]::DoEvents() }
    if ($child.ExitCode -ne 0) {
      $status.Text = 'Upload failed. Check Cloudflare login and try again. Secret values were not printed.'
      $upload.Enabled = $true
    } else {
      $status.Text = 'Success: all six secrets uploaded. Tell Codex "uploaded" so it can verify the Worker.'
      foreach ($box in $boxes.Values) { $box.Clear(); $box.Enabled = $false }
    }
    $child.Dispose()
  } catch {
    $status.Text = 'Upload could not finish. Check your connection and Cloudflare login, then retry.'
    $upload.Enabled = $true
  } finally {
    $values.Clear()
    $close.Enabled = $true
  }
})
[void]$form.ShowDialog()
$form.Dispose()
