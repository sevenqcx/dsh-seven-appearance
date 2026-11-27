import { isZhUi } from './i18n.js';
import { formatSelectionQuote } from './selection-ask-controller.js';

const SIDE_QUESTION_KIND = 'obsidian-prism-question';
const SIDE_QUESTION_ENTRY = 'dsh-obsidian-prism:side-question';
const SIDE_QUESTION_SLOT = 'obsidian-prism.side-question.conversation';
const SIDE_QUESTION_ADDRESS = `dsh-resource://${SIDE_QUESTION_KIND}/session/`;

export async function openSelectionInSidebar({ sidebarRight, sessions }, sessionId, text, mode, zh) {
  const prompt = formatSelectionQuote(text, mode, zh);
  const isCurrent = () => sidebarRight.commandTarget(null)?.sessionId === sessionId;
  if (!prompt || !sessionId || !isCurrent()) throw new Error('Side question requires the active conversation');
  const childId = await sessions.fork({ sessionId, increaseTitle: true });
  if (!isCurrent()) throw new Error('Active conversation changed');
  sidebarRight.openResource(`${SIDE_QUESTION_ADDRESS}${encodeURIComponent(childId)}`, {
    kind: SIDE_QUESTION_KIND,
    destination: 'sidebar',
    params: { prompt },
  });
}

function readSideQuestionSession(address) {
  if (!address.startsWith(SIDE_QUESTION_ADDRESS)) return null;
  const segment = address.slice(SIDE_QUESTION_ADDRESS.length);
  if (!segment || /[/?#]/.test(segment)) return null;
  try { return decodeURIComponent(segment); } catch { return null; }
}

export function registerSideQuestion(ctx, React, store) {
  const { sessions, sidebarRightTabs, resources, slots, conversation } = ctx;
  const { createElement: h, useEffect, useState } = React;
  const initialized = new WeakSet();

  function ChatView({ renderSlot }) {
    return renderSlot('conversation.session', { view: 'chat' });
  }

  function QuestionConversation({ renderFactorySlot }) {
    return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, {
      slots: { views: ChatView },
    });
  }

  function QuestionTab({ useTabInfo, useResource, SessionProvider, renderSlot }) {
    const { tab } = useTabInfo();
    const resource = useResource(tab.contentId);
    const prompt = tab.navigation.params?.prompt;
    const reference = resource.value;
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (!reference || typeof prompt !== 'string' || !prompt) return;
      let active = true;
      reference.ready.then(() => {
        if (!active || initialized.has(reference)) return;
        const binding = sessions.binding(reference.sessionId);
        if (!binding) throw new Error('Sidebar session is not retained');
        if (conversation.input.requestDraftInitialization(binding, { prompt, whenDraftExists: 'keep' }) === 'blocked') {
          throw new Error('Sidebar draft could not be initialized');
        }
        initialized.add(reference);
      }).catch(() => { if (active) setFailed(true); });
      return () => { active = false; };
    }, [reference, prompt]);

    const zh = isZhUi(store.get());
    return h('div', { className: 'op-side-question' },
      (failed || resource.status === 'failed') && h('p', { role: 'status' }, zh ? '侧边追问未能载入。' : 'Could not load the sidebar question.'),
      reference && h(SessionProvider, { session: reference }, renderSlot(SIDE_QUESTION_SLOT, {})),
    );
  }

  ctx.effect(() => resources.register({
    protocol: SIDE_QUESTION_KIND,
    async *open(address, { signal }) {
      const sessionId = readSideQuestionSession(address);
      if (!sessionId || signal.aborted) return;
      const reference = sessions.retain(sessionId, { source: 'sidebarChat', signal });
      const closed = new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      try {
        await reference.ready;
        if (signal.aborted) return;
        yield { ok: true, value: reference };
        await closed;
      } catch (error) {
        if (!signal.aborted) yield { ok: false, error };
      } finally {
        reference.release();
      }
    },
  }), SIDE_QUESTION_ENTRY);
  ctx.effect(() => sidebarRightTabs.register({
    id: SIDE_QUESTION_ENTRY,
    kind: SIDE_QUESTION_KIND,
    patterns: [`${SIDE_QUESTION_ADDRESS}**`],
    canOpen: (address) => Boolean(readSideQuestionSession(address)),
    title: () => isZhUi(store.get()) ? '侧边追问' : 'Side question',
  }), `${SIDE_QUESTION_ENTRY}: tab`);
  slots.inject('sidebar.right.pane.tab', () => slots.register({
    name: 'sidebar.right.pane.tab',
    key: SIDE_QUESTION_ENTRY,
    children: { [SIDE_QUESTION_SLOT]: { kind: 'single', scope: 'session' } },
  }, QuestionTab));
  slots.inject(SIDE_QUESTION_SLOT, () => slots.register({ name: SIDE_QUESTION_SLOT }, QuestionConversation));
}
