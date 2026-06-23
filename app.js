// ==========================================
// CONFIGURATION (Replace with your credentials)
// ==========================================
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Initialize Supabase Client
let supabase = null;
if (SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY") {
  supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Elements Selection
const authSection = document.getElementById('auth-section');
const consoleSection = document.getElementById('console-section');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authError = document.getElementById('auth-error');

const headerUserMenu = document.getElementById('header-user-menu');
const userDisplayEmail = document.getElementById('user-display-email');
const logoutBtn = document.getElementById('logout-btn');

const apiKeyInput = document.getElementById('api-key-input');
const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
const copyKeyBtn = document.getElementById('copy-key-btn');
const rotateKeyBtn = document.getElementById('rotate-key-btn');
const walletBalance = document.getElementById('wallet-balance');

// State Management
let isSignUpMode = true;
let currentUser = null;
let currentApiKey = '';

// Toggle between Sign Up and Sign In
authSwitchBtn.addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  authError.classList.add('hidden');
  
  if (isSignUpMode) {
    authTitle.textContent = "Create your account";
    authSubtitle.textContent = "Start hosting and deploying with Blue AI";
    authSubmitBtn.textContent = "Create Account";
    authSwitchText.textContent = "Already have an account?";
    authSwitchBtn.textContent = "Sign In";
  } else {
    authTitle.textContent = "Welcome back";
    authSubtitle.textContent = "Sign in to manage your keys and balance";
    authSubmitBtn.textContent = "Sign In";
    authSwitchText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = "Sign Up";
  }
});

// Authentication Handling
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  
  const email = authEmail.value;
  const password = authPassword.value;

  if (!supabase) {
    showError("Supabase is not configured. Please open app.js and fill in your SUPABASE_URL and SUPABASE_ANON_KEY.");
    return;
  }

  try {
    if (isSignUpMode) {
      // Sign Up
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showError("Success! Please check your email to confirm registration, then sign in.");
      isSignUpMode = false;
      authSwitchBtn.click();
    } else {
      // Sign In
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Triggers session change listener automatically
    }
  } catch (err) {
    showError(err.message || "An authentication error occurred.");
  }
});

// Sign Out
logoutBtn.addEventListener('click', async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }
  showSignedOutState();
});

// Manage Key Visibility
toggleKeyVisibilityBtn.addEventListener('click', () => {
  const icon = toggleKeyVisibilityBtn.querySelector('i');
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    apiKeyInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
});

// Copy Key to Clipboard
copyKeyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentApiKey).then(() => {
    const icon = copyKeyBtn.querySelector('i');
    icon.classList.remove('fa-copy');
    icon.classList.add('fa-check', 'text-green-400');
    setTimeout(() => {
      icon.classList.remove('fa-check', 'text-green-400');
      icon.classList.add('fa-copy');
    }, 1500);
  });
});

// Rotate API Key
rotateKeyBtn.addEventListener('click', async () => {
  if (!confirm("Are you sure you want to rotate your API Key? The old key will stop working immediately inside your VS Code extension.")) {
    return;
  }
  await generateAndSaveKey(currentUser.id, true);
});

// Display Error Message
function showError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
}

// Display UI States
function showSignedInState(user) {
  currentUser = user;
  authSection.classList.add('hidden');
  consoleSection.classList.remove('hidden');
  headerUserMenu.classList.remove('hidden');
  userDisplayEmail.textContent = user.email;
  
  // Load user data
  loadUserData(user.id);
}

function showSignedOutState() {
  currentUser = null;
  currentApiKey = '';
  authSection.classList.remove('hidden');
  consoleSection.classList.add('hidden');
  headerUserMenu.classList.add('hidden');
  userDisplayEmail.textContent = '';
  apiKeyInput.value = '';
}

// Load balance and API keys from Supabase
async function loadUserData(userId) {
  if (!supabase) return;
  
  try {
    // 1. Fetch Wallet Balance
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();
      
    if (walletError && walletError.code === 'PGRST116') {
      // Wallet record doesn't exist, create initial free tier wallet
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: 1.00 }) // $1.00 free credit tier
        .select()
        .single();
      if (!createError && newWallet) {
        walletBalance.textContent = `$${newWallet.balance.toFixed(2)}`;
      }
    } else if (!walletError && walletData) {
      walletBalance.textContent = `$${walletData.balance.toFixed(2)}`;
    }

    // 2. Fetch API Key
    const { data: keyData, error: keyError } = await supabase
      .from('user_keys')
      .select('key')
      .eq('user_id', userId)
      .single();

    if (keyError && keyError.code === 'PGRST116') {
      // Key doesn't exist, generate new one
      await generateAndSaveKey(userId, false);
    } else if (!keyError && keyData) {
      currentApiKey = keyData.key;
      apiKeyInput.value = currentApiKey;
    }
  } catch (err) {
    console.error("Error loading user data:", err);
  }
}

// Generate secure API Key
async function generateAndSaveKey(userId, isUpdate = false) {
  if (!supabase) return;

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let keyString = 'blue_';
  for (let i = 0; i < 32; i++) {
    keyString += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  try {
    if (isUpdate) {
      const { error } = await supabase
        .from('user_keys')
        .update({ key: keyString })
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_keys')
        .insert({ user_id: userId, key: keyString });
      if (error) throw error;
    }
    
    currentApiKey = keyString;
    apiKeyInput.value = currentApiKey;
  } catch (err) {
    console.error("Error generating key:", err);
  }
}

// Listener for Supabase Auth state changes
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      showSignedInState(session.user);
    } else {
      showSignedOutState();
    }
  });
} else {
  // If Supabase is unconfigured, show a helper message
  apiKeyInput.value = "Enter credentials in app.js to initialize";
}
