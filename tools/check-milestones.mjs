import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const expected = [3, 5, 10, 12];

if (!/const eligible=\[3,5,10,12\]/.test(source)) throw new Error('Milestone thresholds changed: expected 3, 5, 10, 12.');
for (const n of expected) {
  if (!new RegExp(`\\n\\s*${n}:\\{title:`).test(source)) throw new Error(`Milestone ${n} is missing.`);
}
if (!source.includes('if(reached)state.pendingMilestone={count:reached,target:t};')) throw new Error('Check-in does not queue a newly reached milestone.');
if (!source.includes('if(showNext)showPendingMilestone();')) throw new Error('Check-in flow no longer opens pending milestones.');
if (!source.includes('function renderMapList()') || !source.includes('data-focus-target')) throw new Error('Numbered map list is missing.');
if (!source.includes('setOverviewTrack(t,{pinned:true})')) throw new Error('Map list focus does not pin the selected route.');
if (source.includes('onclick=\"openTour(') || source.includes('onclick=\"openBook(')) throw new Error('Map/tour actions still use inline onclick handlers, which CSP blocks.');
if (!source.includes('bindTargetPopupActions')) throw new Error('Map popup action binding is missing.');
if (!source.includes('state.isTestMode=me.testMode===true')) throw new Error('Test-mode milestone namespace is not detected.');

const start = source.indexOf('function milestone(collected){');
const end = source.indexOf('function showMilestoneAfterCheckin(){', start);
if (start < 0 || end < 0) throw new Error('Could not isolate milestone function for runtime test.');
const fn = source.slice(start, end) + '\n globalThis.testMilestone = milestone;';

const elements = {
  '#milestoneModal': { classList: { remove() {}, add() {} } },
  '#milestoneTitle': { textContent: '' },
  '#milestoneText': { textContent: '' },
  '#milestoneWarzi': { classList: { toggle() {} }, alt: '' }
};
const storage = new Map();
const context = {
  state: { user: { id: 'test-user' } },
  $: selector => elements[selector],
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  console
};
vm.createContext(context);
vm.runInContext(fn, context);

for (const n of expected) {
  storage.clear();
  const first = context.testMilestone(n);
  const second = context.testMilestone(n);
  if (first !== true || second !== false) throw new Error(`Milestone ${n} did not trigger exactly once.`);
}

console.log('Milestone regression check passed: 3 / 5 / 10 / 12 trigger exactly once.');
console.log('Map-list regression check passed: numbered clickable targets and route focus are present.');

const server=fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
if (!server.includes('testMode: TEST_CHECKIN_MODE')) throw new Error('Server /api/me does not expose test mode.');
console.log('Server test-mode flag check passed.');
