(() => {
  const supabaseLibrary = window.supabase;

  if (!supabaseLibrary || !supabaseLibrary.createClient) {
    console.error("Supabase CDN load nahi hui.");
    return;
  }

  window.supabaseClient = supabaseLibrary.createClient(
    "https://crctsbfvaykwgkvfqxgo.supabase.co",
    "sb_publishable_KT0SuWxGnWbEaEX6gz45rg_7Rxg5r58"
  );

  console.log("Anantmart Supabase client initialized.");
})();