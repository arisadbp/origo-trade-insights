import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, RefreshCw, Send, Trash2, User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AgentTopic,
  buildAgentReply,
  loadAgentDataSnapshot,
  type AgentDataSnapshot,
} from "@/lib/customerAiAgent";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  topic: AgentTopic;
  messages: ChatMessage[];
  updatedAt: string;
};

type ParsedMarketCustomerItem = {
  name: string;
  location: string;
  last: string;
  trades: string;
};

type ParsedMarketCustomerSection = {
  status: string;
  countLabel: string;
  items: ParsedMarketCustomerItem[];
};

type ParsedMarketCustomerMessage = {
  title: string;
  sections: ParsedMarketCustomerSection[];
};

type ParsedStructuredItem = {
  title: string;
  meta: string[];
};

type ParsedStructuredBlock = {
  title: string;
  bullets: string[];
  items: ParsedStructuredItem[];
  notes: string[];
};

type TopicOption = {
  value: AgentTopic;
  label: string;
};

const TOPIC_OPTIONS: TopicOption[] = [
  { value: "all", label: "All" },
  { value: "market_intelligence", label: "Market Intelligence" },
  { value: "orders_shipments", label: "Orders & Shipments" },
  { value: "inventory", label: "Inventory" },
  { value: "invoices_payments", label: "Invoices & Payments" },
];

const CHAT_STORAGE_KEY = "origo-ai-chat-sessions-v1";
const WELCOME_TEXT = "ORIGO AI Agent พร้อมใช้งาน พิมพ์คำถามเพื่อวิเคราะห์จากฐานข้อมูลจริงของคุณ เช่น “สรุปใบแจ้งหนี้ค้างชำระ”";

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createWelcomeMessage = (): ChatMessage => ({
  id: createMessageId(),
  role: "assistant",
  text: WELCOME_TEXT,
  createdAt: new Date().toISOString(),
});

const buildNewSession = (topic: AgentTopic): ChatSession => {
  const now = new Date().toISOString();
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New Chat",
    topic,
    messages: [createWelcomeMessage()],
    updatedAt: now,
  };
};

const deriveSessionTitle = (messageText: string) => {
  const singleLine = messageText.replace(/\s+/g, " ").trim();
  if (!singleLine) return "New Chat";
  return singleLine.length > 42 ? `${singleLine.slice(0, 42)}...` : singleLine;
};

const sanitizeStoredSessions = (value: unknown): ChatSession[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((session): ChatSession | null => {
      if (!session || typeof session !== "object") return null;
      const raw = session as Record<string, unknown>;
      const messages = Array.isArray(raw.messages)
        ? raw.messages
          .map((message): ChatMessage | null => {
            if (!message || typeof message !== "object") return null;
            const m = message as Record<string, unknown>;
            if ((m.role !== "assistant" && m.role !== "user") || typeof m.text !== "string") return null;
            return {
              id: typeof m.id === "string" ? m.id : createMessageId(),
              role: m.role,
              text: m.text,
              createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
            };
          })
          .filter((message): message is ChatMessage => Boolean(message))
        : [];

      const topic = raw.topic;
      const normalizedTopic: AgentTopic =
        topic === "market_intelligence" || topic === "orders_shipments" || topic === "inventory" || topic === "invoices_payments"
          ? topic
          : "all";

      return {
        id: typeof raw.id === "string" ? raw.id : `chat-${Math.random().toString(36).slice(2, 10)}`,
        title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "New Chat",
        topic: normalizedTopic,
        messages: messages.length > 0 ? messages : [createWelcomeMessage()],
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
      };
    })
    .filter((session): session is ChatSession => Boolean(session));
};

const loadStoredSessions = () => {
  if (typeof window === "undefined") return [] as ChatSession[];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [] as ChatSession[];
    return sanitizeStoredSessions(JSON.parse(raw));
  } catch {
    return [] as ChatSession[];
  }
};

const parseMarketCustomerMessage = (text: string): ParsedMarketCustomerMessage | null => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || !lines[0].toLowerCase().startsWith("market intelligence customer list:")) {
    return null;
  }

  const sections: ParsedMarketCustomerSection[] = [];
  let currentSection: ParsedMarketCustomerSection | null = null;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionMatch = line.match(/^\[(.+)\]\s+(.+)$/);
    if (sectionMatch) {
      currentSection = {
        status: sectionMatch[1],
        countLabel: sectionMatch[2],
        items: [],
      };
      sections.push(currentSection);
      continue;
    }

    const itemMatch = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+last\s+(.+?)\s+\|\s+trades\s+(.+)$/i);
    if (itemMatch && currentSection) {
      currentSection.items.push({
        name: itemMatch[1],
        location: itemMatch[2],
        last: itemMatch[3],
        trades: itemMatch[4],
      });
    }
  }

  return {
    title: lines[0],
    sections,
  };
};

const parseStructuredMessage = (text: string): ParsedStructuredBlock[] | null => {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const parsed = blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const title = lines[0] ?? "";
    const bullets: string[] = [];
    const items: ParsedStructuredItem[] = [];
    const notes: string[] = [];

    lines.slice(1).forEach((line) => {
      const bullet = line.match(/^-\s+(.+)$/);
      if (bullet) {
        bullets.push(bullet[1]);
        return;
      }

      const numbered = line.match(/^\d+\.\s+(.+)$/);
      if (numbered) {
        const parts = numbered[1].split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
        items.push({
          title: parts[0] ?? numbered[1],
          meta: parts.slice(1),
        });
        return;
      }

      notes.push(line);
    });

    return {
      title,
      bullets,
      items,
      notes,
    } satisfies ParsedStructuredBlock;
  });

  const hasStructure = parsed.some((block) => block.items.length > 0 || block.bullets.length > 0 || block.notes.length > 0);
  if (!hasStructure) return null;
  return parsed;
};

const resolveRouteFromText = (value: string) => {
  const text = value.toLowerCase();

  if (/market intelligence|market trend|prospect|lead|ลูกค้า|ตลาด/.test(text)) return "/market-intelligence";
  if (/orders|shipments|shipment|contract|delivery|ส่งมอบ|ขนส่ง|สัญญา/.test(text)) return "/my-company/orders";
  if (/invoices|invoice|payments|payment|ใบแจ้งหนี้|ชำระ/.test(text)) return "/my-company/invoices";
  if (/inventory|stock|warehouse|คลัง|สต๊อก/.test(text)) return "/my-company/inventory";
  if (/upload|file|review|อัปโหลด|ไฟล์/.test(text)) return "/upload";
  if (/performance|my company|thai roong ruang|trr|ภาพรวมบริษัท|ผลการดำเนินงาน/.test(text)) return "/my-company/performance";

  return null;
};

function AssistantMessageContent({ text, onNavigate }: { text: string; onNavigate: (path: string) => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showAllItems, setShowAllItems] = useState<Record<string, boolean>>({});
  const [showAllBlockItems, setShowAllBlockItems] = useState<Record<string, boolean>>({});
  const parsedMarketList = parseMarketCustomerMessage(text);
  const parsedStructuredBlocks = parsedMarketList ? null : parseStructuredMessage(text);
  if (!parsedMarketList) {
    if (!parsedStructuredBlocks) return <div className="whitespace-pre-wrap">{text}</div>;

    return (
      <div className="space-y-2.5">
        {parsedStructuredBlocks.map((block, blockIndex) => {
          const blockKey = `${block.title}-${blockIndex}`;
          const showAll = showAllBlockItems[blockKey] ?? false;
          const visibleItems = showAll ? block.items : block.items.slice(0, 3);

          return (
            <section key={blockKey} className="rounded-xl border border-border/70 bg-background/60 p-2.5">
              <p className="text-sm font-semibold">{block.title}</p>

              {block.bullets.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {block.bullets.map((bullet, index) => {
                    const keyValue = bullet.match(/^([^:]+):\s*(.+)$/);
                    if (!keyValue) {
                      return (
                        <p key={`${blockKey}-bullet-${index}`} className="text-xs text-muted-foreground">
                          {bullet}
                        </p>
                      );
                    }
                    return (
                      <p key={`${blockKey}-bullet-${index}`} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{keyValue[1]}:</span> {keyValue[2]}
                      </p>
                    );
                  })}
                </div>
              ) : null}

              {block.items.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {visibleItems.map((item, index) => (
                    <button
                      key={`${blockKey}-item-${index}`}
                      type="button"
                      className="w-full rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left hover:bg-muted/40"
                      onClick={() => {
                        const route =
                          resolveRouteFromText([block.title, item.title, ...item.meta].join(" ")) ??
                          resolveRouteFromText(block.title);
                        if (route) onNavigate(route);
                      }}
                    >
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      {item.meta.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.meta.join(" · ")}
                        </p>
                      ) : null}
                    </button>
                  ))}

                  {block.items.length > 3 ? (
                    <button
                      type="button"
                      className="w-full rounded-lg border border-dashed border-border/70 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllBlockItems((prev) => ({ ...prev, [blockKey]: !showAll }))}
                    >
                      {showAll ? "ย่อรายการ" : `ดูเพิ่มอีก ${block.items.length - 3} รายการ`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {block.notes.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {block.notes.map((note, index) => (
                    <p key={`${blockKey}-note-${index}`} className="text-xs text-muted-foreground">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}

              {resolveRouteFromText([block.title, ...block.bullets, ...block.notes].join(" ")) ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    const route = resolveRouteFromText([block.title, ...block.bullets, ...block.notes].join(" "));
                    if (route) onNavigate(route);
                  }}
                >
                  ดูรายการที่เกี่ยวข้อง
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
        <p className="text-sm font-semibold">{parsedMarketList.title}</p>
      </div>

      <div className="space-y-2.5">
        {parsedMarketList.sections.map((section, sectionIndex) => {
          const sectionKey = `${section.status}-${sectionIndex}`;
          const expanded = expandedSections[sectionKey] ?? sectionIndex === 0;
          const expandedItems = showAllItems[sectionKey] ?? false;
          const visibleItems = expandedItems ? section.items : section.items.slice(0, 2);

          return (
            <section key={sectionKey} className="rounded-xl border border-border/70 bg-background/60 p-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setExpandedSections((prev) => ({ ...prev, [sectionKey]: !expanded }))}
              >
                <p className="text-sm font-semibold">{section.status}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full text-[11px]">
                    {section.countLabel}
                  </Badge>
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {expanded ? (
                <div className="mt-2 space-y-1.5">
                  {visibleItems.map((item, index) => (
                    <button
                      key={`${section.status}-${item.name}-${index}`}
                      type="button"
                      className="w-full rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left hover:bg-muted/40"
                      onClick={() => onNavigate("/market-intelligence")}
                    >
                      <p className="text-sm font-medium leading-snug">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.location} · {item.last} · trades {item.trades}
                      </p>
                    </button>
                  ))}

                  {section.items.length > 2 ? (
                    <button
                      type="button"
                      className="w-full rounded-lg border border-dashed border-border/70 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllItems((prev) => ({ ...prev, [sectionKey]: !expandedItems }))}
                    >
                      {expandedItems ? "ย่อรายการ" : `ดูเพิ่มอีก ${section.items.length - 2} รายชื่อ`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function AIAgent() {
  const navigate = useNavigate();
  const { email, username } = useAuth();
  const [snapshot, setSnapshot] = useState<AgentDataSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [question, setQuestion] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadStoredSessions();
    if (stored.length > 0) return stored;
    return [buildNewSession("all")];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [topic, setTopic] = useState<AgentTopic>("all");
  const [replying, setReplying] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [sessions, activeSessionId],
  );
  const activeMessages = useMemo(
    () => activeSession?.messages ?? [],
    [activeSession],
  );
  const hasUserMessages = useMemo(
    () => activeMessages.some((message) => message.role === "user"),
    [activeMessages],
  );
  const displayMessages = useMemo(() => {
    if (hasUserMessages) return activeMessages;
    return activeMessages.filter((message) => !(message.role === "assistant" && message.text === WELCOME_TEXT));
  }, [activeMessages, hasUserMessages]);
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)),
    [sessions],
  );

  useEffect(() => {
    if (activeSessionId) return;
    if (sessions[0]) setActiveSessionId(sessions[0].id);
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!activeSession) return;
    setTopic(activeSession.topic);
  }, [activeSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const loadSnapshot = async () => {
    setLoadingSnapshot(true);
    setFatalError(null);
    try {
      const data = await loadAgentDataSnapshot(email, username);
      setSnapshot(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load database snapshot";
      setFatalError(message);
      return null;
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const appendMessage = (sessionId: string, message: ChatMessage, currentTopic: AgentTopic) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextTitle =
          session.title === "New Chat" && message.role === "user"
            ? deriveSessionTitle(message.text)
            : session.title;
        return {
          ...session,
          title: nextTitle,
          topic: currentTopic,
          messages: [...session.messages, message],
          updatedAt: message.createdAt,
        };
      }),
    );
  };

  const startNewChat = () => {
    const session = buildNewSession(topic);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setQuestion("");
  };

  const deleteChat = (sessionId: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this chat history?");
      if (!ok) return;
    }

    let nextActiveSessionId: string | null = null;
    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== sessionId);
      if (remaining.length === 0) {
        const fallback = buildNewSession(topic);
        nextActiveSessionId = fallback.id;
        return [fallback];
      }

      if (activeSessionId === sessionId) {
        const latest = [...remaining].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))[0];
        nextActiveSessionId = latest?.id ?? remaining[0].id;
      }

      return remaining;
    });

    if (nextActiveSessionId) setActiveSessionId(nextActiveSessionId);
  };

  const askAgent = async (input: string) => {
    const content = input.trim();
    if (!content || !activeSession) return;

    const sessionId = activeSession.id;
    setReplying(true);
    appendMessage(sessionId, {
      id: createMessageId(),
      role: "user",
      text: content,
      createdAt: new Date().toISOString(),
    }, topic);
    setQuestion("");

    const data = snapshot ?? await loadSnapshot();
    if (!data) {
      appendMessage(sessionId, {
        id: createMessageId(),
        role: "assistant",
        text: "ไม่สามารถอ่านข้อมูลจากฐานข้อมูลได้ตอนนี้ ตรวจสอบ Supabase config และสิทธิ์ตารางก่อน",
        createdAt: new Date().toISOString(),
      }, topic);
      setReplying(false);
      return;
    }

    const reply = buildAgentReply(content, data, topic);
    appendMessage(sessionId, {
      id: createMessageId(),
      role: "assistant",
      text: reply,
      createdAt: new Date().toISOString(),
    }, topic);
    setReplying(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await askAgent(question);
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="AI Agent"
        subtitle="Beta: Chat-style assistant for database-driven customer analysis"
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">ORIGO Customer Analyst</h2>
              <Badge className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Beta
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              วิเคราะห์จากข้อมูลจริงใน Supabase: uploads, invoices, stock, purchase trend
            </p>
          </div>

          <div className="p-4 md:p-5">
            <section className="grid min-h-[620px] gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Chats</p>
                  <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={startNewChat}>
                    New Chat
                  </Button>
                </div>
                <div className="mt-2 max-h-[190px] space-y-1.5 overflow-auto pr-1 md:max-h-[680px]">
                  {sortedSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-start gap-1 rounded-xl border px-2 py-2 transition-colors ${
                        activeSession?.id === session.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/70 bg-card hover:bg-muted/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className="min-w-0 flex-1 px-1 text-left"
                      >
                        <p className="truncate text-xs font-medium">{session.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(session.updatedAt).toLocaleString()}
                        </p>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => deleteChat(session.id)}
                        aria-label={`Delete chat ${session.title}`}
                        title="Delete chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="flex h-full min-h-[620px] flex-col rounded-2xl border border-border/70 bg-background/80 p-3 md:p-4">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Chat</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={loadingSnapshot}
                    onClick={async () => {
                      await loadSnapshot();
                    }}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingSnapshot ? "animate-spin" : ""}`} />
                    Refresh Data
                  </Button>
                </div>

                {fatalError ? (
                  <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {fatalError}
                  </div>
                ) : null}

                <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl bg-muted/25">
                  <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
                    {!hasUserMessages && displayMessages.length === 0 ? (
                      <div className="mx-auto flex min-h-[220px] max-w-2xl flex-col items-center justify-center px-4 text-center">
                        <p className="text-2xl font-semibold tracking-tight text-foreground">What can I help with?</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Ask about Market Intelligence, Orders & Shipments, Inventory, or Invoices & Payments.
                        </p>
                      </div>
                    ) : null}

                    {displayMessages.map((message) => (
                      <article
                        key={message.id}
                        className={`mx-auto flex w-full max-w-3xl gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" ? (
                          <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                            <Bot className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div
                          className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "border-primary/30 bg-primary/10 text-foreground"
                              : "border-border/70 bg-card text-foreground"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <AssistantMessageContent text={message.text} onNavigate={navigate} />
                          ) : (
                            <div className="whitespace-pre-wrap">{message.text}</div>
                          )}
                        </div>
                        {message.role === "user" ? (
                          <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <User2 className="h-4 w-4" />
                          </span>
                        ) : null}
                      </article>
                    ))}
                    {replying ? (
                      <article className="mx-auto flex w-full max-w-3xl gap-2">
                        <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                          <Bot className="h-4 w-4" />
                        </span>
                        <div className="rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
                          ????????????????????????????????????????????????????????????...
                        </div>
                      </article>
                    ) : null}
                  </div>

                  <div className="border-t border-border/60 bg-background/85 p-3 backdrop-blur-sm md:p-4">
                    <div className="mx-auto max-w-3xl">
                      <div className="mb-2 flex flex-wrap gap-2">
                        {TOPIC_OPTIONS.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setTopic(item.value);
                              if (!activeSession) return;
                              setSessions((prev) => prev.map((session) => (
                                session.id === activeSession.id
                                  ? { ...session, topic: item.value }
                                  : session
                              )));
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              topic === item.value
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={onSubmit} className="flex gap-2">
                        <Input
                          value={question}
                          onChange={(event) => setQuestion(event.target.value)}
                          placeholder="ถาม AI Agent เช่น: สรุปใบแจ้งหนี้ค้างชำระของเดือนนี้"
                          className="h-11 rounded-full border-border/70 bg-card/90 px-4"
                        />
                        <Button
                          type="submit"
                          disabled={replying || loadingSnapshot || !question.trim()}
                          className="h-11 rounded-full px-4"
                        >
                          <Send className="mr-1.5 h-4 w-4" />
                          Send
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
