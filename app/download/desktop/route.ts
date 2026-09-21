import { NextResponse } from "next/server";

const RELEASE_API =
  "https://api.github.com/repos/om-2007/blue-desktop-releases/releases/latest";
const FALLBACK_INSTALLER =
  "https://github.com/om-2007/blue-desktop-releases/releases/download/v0.1.12/Blue-Desktop-0.1.12-Setup.exe";

type GitHubRelease = {
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

function isWindowsInstaller(name: string | undefined) {
  return Boolean(name && /^Blue-Desktop-.*-Setup\.exe$/i.test(name));
}

export async function GET() {
  let installerUrl = FALLBACK_INSTALLER;

  try {
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Blue-Desktop-Website",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 300 },
    });

    if (response.ok) {
      const release = (await response.json()) as GitHubRelease;
      const installer = release.assets?.find((asset) =>
        isWindowsInstaller(asset.name),
      );

      if (installer?.browser_download_url) {
        installerUrl = installer.browser_download_url;
      }
    }
  } catch {
    // Keep the verified release available if GitHub's API is temporarily down.
  }

  return NextResponse.redirect(installerUrl, 307);
}
