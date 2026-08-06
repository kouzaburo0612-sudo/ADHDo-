import { test, expect } from "@playwright/test";

// 主要フローのE2E(仕様書 §7: 主要フローのE2E最低1本)
// 外部サービス(Supabase / Anthropic)はルートインターセプトでモックし、
// 画面遷移とUIの動作を通しで検証する:
// 作成STEP1 → Google連携(準備中) → STEP2 → AI候補生成 → 確認 → 保存 → 共有ページ

test("イベント作成の主要フローが通しで完了する", async ({ page }) => {
  // AI候補生成APIをモック
  await page.route("**/api/ai/candidates", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [
          { date: "2099-07-27", start: "14:00", end: "15:00" },
          { date: "2099-07-27", start: "15:00", end: "16:00" },
          { date: "2099-07-30", start: "16:30", end: "17:30" },
        ],
      }),
    })
  );
  // イベント保存APIをモック
  await page.route("**/api/events", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ code: "test1234", adminToken: "admintoken" }),
      });
    }
    return route.continue();
  });

  // ホーム
  await page.goto("/");
  await expect(page.getByText("Alfyのお約束")).toBeVisible();
  await page.getByRole("link", { name: "日程調整をつくる" }).click();

  // STEP1(devサーバーの初回コンパイルが遅いことがあるため長めに待つ)
  await page.waitForURL(/\/new$/, { timeout: 30_000 });
  await page.getByLabel("イベント名").fill("E2Eテスト会議");
  await page.getByRole("button", { name: "60分" }).click();
  await page.getByRole("button", { name: "次へ(空き時間の入力)" }).click();

  // Google連携(準備中)ページ
  await page.waitForURL(/\/new\/google$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /準備中/ })).toBeDisabled();
  await page.getByRole("link", { name: "手書き・テキストで入力する" }).click();

  // STEP2: 空き時間入力 → AI候補生成
  await page.waitForURL(/\/new\/availability$/, { timeout: 30_000 });
  await page
    .getByPlaceholder(/来週の月曜午後/)
    .fill("7/27(月) 14:00〜18:00 / 7/30(木) 16:30〜18:00");
  await page.getByRole("button", { name: "候補をつくる" }).click();

  // 候補確認(確認をスキップしない — 仕様書 §3-5)
  await expect(page.getByText("候補をおつくりしました")).toBeVisible();
  await expect(page.getByText("7/27(月) 14:00〜15:00")).toBeVisible();
  await expect(page.getByText("7/30(木) 16:30〜17:30")).toBeVisible();

  // 候補を1つ削除できる
  await page.getByRole("button", { name: "7/27(月) 15:00〜16:00 を削除" }).click();
  await expect(page.getByText("7/27(月) 15:00〜16:00")).toBeHidden();

  // 保存 → 共有ページ
  await page.getByRole("button", { name: "この予定で確定(イベント保存)" }).click();
  await page.waitForURL(/\/e\/test1234\/share\?token=admintoken$/, { timeout: 30_000 });
  await expect(page.getByText("イベントをつくりました")).toBeVisible();
  await expect(page.getByRole("link", { name: "LINEで送る" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理ページへ" })).toBeVisible();

  // ホームの「あなたの日程調整」から管理ページへ戻れる(幹事の導線)
  await page.goto("/");
  await expect(page.getByText("あなたの日程調整")).toBeVisible();
  await expect(page.getByRole("link", { name: "管理" })).toHaveAttribute(
    "href",
    "/e/test1234/admin?token=admintoken"
  );
});

test("入力保持: 戻る・進む・リロードでもSTEP1/STEP2の入力が残る", async ({ page }) => {
  // STEP1入力
  await page.goto("/new");
  await page.getByLabel("イベント名").fill("保持テスト会議");
  await page.getByRole("button", { name: "90分" }).click();
  await page.waitForTimeout(500); // debounce保存を待つ

  // STEP2へ進んでテキスト入力
  await page.getByRole("button", { name: "次へ(空き時間の入力)" }).click();
  await page.waitForURL(/\/new\/google$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "手書き・テキストで入力する" }).click();
  await page.waitForURL(/\/new\/availability$/, { timeout: 30_000 });
  await page.getByPlaceholder(/来週の月曜午後/).fill("月曜午後が空いてます");
  await page.waitForTimeout(500);

  // ブラウザ戻る×2 → STEP1の入力が残っている
  await page.goBack();
  await page.goBack();
  await page.waitForURL(/\/new$/, { timeout: 30_000 });
  await expect(page.getByLabel("イベント名")).toHaveValue("保持テスト会議", { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "90分" })).toHaveClass(/selected/);

  // リロードしても残る
  await page.reload();
  await expect(page.getByLabel("イベント名")).toHaveValue("保持テスト会議", { timeout: 10_000 });

  // 進む×2 → STEP2のテキストも残っている
  await page.goForward();
  await page.goForward();
  await page.waitForURL(/\/new\/availability$/, { timeout: 30_000 });
  await expect(page.getByPlaceholder(/来週の月曜午後/)).toHaveValue("月曜午後が空いてます", {
    timeout: 10_000,
  });

  // STEP2をリロードしても残る
  await page.reload();
  await expect(page.getByPlaceholder(/来週の月曜午後/)).toHaveValue("月曜午後が空いてます", {
    timeout: 10_000,
  });
});

test("回答ページ: 登録不要で○△×回答と代理回答ができる", async ({ page }) => {
  // イベント取得APIをモック
  await page.route("**/api/events/test1234", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        event: {
          code: "test1234",
          title: "E2Eテスト会議",
          durationMinutes: 60,
          deadline: null,
          status: "open",
          confirmedSlotId: null,
          isAdmin: false,
        },
        slots: [
          { id: "s1", date: "2099-07-27", start_time: "14:00:00", end_time: "15:00:00" },
          { id: "s2", date: "2099-07-30", start_time: "16:30:00", end_time: "17:30:00" },
        ],
        participants: [],
        responses: [],
      }),
    })
  );
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/events/test1234/respond", async (route) => {
    submittedBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/e/test1234");
  await expect(page.getByRole("heading", { name: "E2Eテスト会議" })).toBeVisible();

  // 代理回答モード
  await page.getByRole("button", { name: "代理で回答" }).click();
  await page.getByLabel("本人の姓").fill("山田");
  await page.getByLabel("代理人の姓").fill("佐藤");

  // ○△×回答
  await page.getByRole("button", { name: "7/27(月) 14:00〜15:00 に ○" }).click();
  await page.getByRole("button", { name: "7/30(木) 16:30〜17:30 に ×" }).click();

  await page.getByRole("button", { name: "回答を送信" }).click();
  await expect(page.getByText("回答を受け付けました")).toBeVisible();

  expect(submittedBody).toMatchObject({
    lastName: "山田",
    proxyLastName: "佐藤",
    answers: { s1: "yes", s2: "no" },
  });
});
