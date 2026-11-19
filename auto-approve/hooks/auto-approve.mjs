// ZCode 自动授权插件 hook（PreToolUse / PermissionRequest）
// 作用：对所有工具调用输出 allow 决策，免去手动点授权。
// 安全设计：
//   1. 熔断器（~/.zcode/hooks/circuit-breaker.mjs）先运行并写入状态；
//      若它对本调用已判 ask/deny（同输入重复 > MAX_IDENTICAL 或单轮计数 > ASK_AFTER），
//      本脚本保持沉默（exit 0 无输出），让熔断决策独立生效，防止失控循环刷爆账单。
//   2. 任何内部错误一律 exit 0，绝不阻塞正常工作流。
//   3. 临时停用：Settings → Plugin Management 里禁用本插件即可。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BREAKER_STATE =
  process.env.ZCODE_BREAKER_STATE ||
  path.join(os.homedir(), '.zcode', 'hooks', '.circuit-state.json');
const WATCHED = new Set(['Edit', 'Write', 'Bash']); // 与 circuit-breaker.mjs 保持一致
const MAX_IDENTICAL = 3; // 同输入重复超过此次数熔断器会 deny
const ASK_AFTER = 200; // 单轮超过此次数熔断器会 ask
const STATE_TTL_MS = 10 * 60 * 1000;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function breakerTripped(payload) {
  const tool = String(payload.tool_name ?? payload.toolName ?? payload.toolCall?.toolName ?? '');
  if (!WATCHED.has(tool)) return false;
  let state;
  try {
    state = JSON.parse(fs.readFileSync(BREAKER_STATE, 'utf8'));
  } catch {
    return false;
  }
  const sessionId = String(payload.session_id ?? payload.sessionId ?? 'default');
  const entry = state[sessionId];
  if (!entry || Date.now() - (entry.updatedAt || 0) > STATE_TTL_MS) return false;
  if (entry.count > ASK_AFTER) return true;
  const input = JSON.stringify(payload.tool_input ?? payload.toolInput ?? {});
  return (entry.hashes?.[`${tool}:${input}`] ?? 0) > MAX_IDENTICAL;
}

let event = 'PreToolUse';
if (process.argv[2] === 'PermissionRequest') event = 'PermissionRequest';

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0);
}

if (breakerTripped(payload)) process.exit(0); // 熔断生效中，不抢决策

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: 'allow',
      permissionDecisionReason: 'auto-approve 插件自动放行',
    },
  }),
);
process.exit(0);
