# lunascope

## Shared Reflection Void (optional)

By default, Reflection Void posts are stored only in this browser. To **show posts from all users**, wire the app to a [Supabase](https://supabase.com) project:

1. Create a project and run the SQL in `supabase/migrations/001_void_posts.sql` (SQL Editor → New query → Run).
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. Copy `config.example.js` to `config.js`, paste your URL and anon key into `window.LUNASCOPE_VOID`, and add a script tag **before** `app.js` in `index.html`:

```html
<script src="config.js"></script>
<script src="app.js"></script>
```

(`config.js` is listed in `.gitignore` so keys are not committed.)

4. Deploy or open the site over **HTTPS** (required for `fetch` to Supabase from many browsers).

The anon key is public by design; restrict abuse with Supabase rate limits, Edge Functions, or stricter RLS later. **My Past Reflections** stays local-only; only the Void syncs when configured.
