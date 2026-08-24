import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RPS_KO, type RpsChoice } from "../src/workshop/rps.ts";

// tsx 는 루트 tsconfig 만 읽는데 거기엔 jsx 설정이 없어(빌드는 tsconfig.app.json 이 한다)
// 컴포넌트가 classic 런타임(React.createElement)으로 변환된다. 소스에 테스트용 import 를
// 더하지 않으려고 여기서만 전역을 채운다.
(globalThis as { React?: unknown }).React = React;
const { RpsIcon } = await import("../src/workshop/RpsIcon.tsx");

/**
 * 아이콘은 픽셀 데이터라 눈으로 보기 전에는 대부분 알 수 없다. 여기서 잡는 건 눈으로
 * 보면 오히려 놓치는 것들이다. 팔레트 밖 색이 새어 들어왔는가, 선택 상태가 실제로
 * 다른 색을 내는가(예전에 없는 토큰을 가리켜 var(undefined) 가 나갔다), 그리드가
 * 19×19 그대로인가(표시 크기 57·76 이 여기에 매여 있다).
 */

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

const render = (choice: RpsChoice, active = false) =>
  renderToStaticMarkup(React.createElement(RpsIcon, { choice, active }));

test("세 선택지 모두 픽셀이 그려진다", () => {
  for (const choice of CHOICES) {
    const html = render(choice);
    const rects = html.match(/<rect /g) ?? [];
    assert.ok(rects.length > 0, `${choice}: rect 가 하나도 없다`);
    assert.ok(html.includes(`aria-label="${RPS_KO[choice]}"`), `${choice}: 라벨이 없다`);
  }
});

test("색은 전부 @theme 토큰이다 — hex 도 var(undefined) 도 없다", () => {
  for (const choice of CHOICES) {
    for (const active of [false, true]) {
      const html = render(choice, active);
      const fills = [...html.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);
      assert.ok(fills.length > 0);
      for (const fill of fills) {
        assert.match(fill, /^var\(--color-[a-z]+-\d+\)$/,
          `${choice}${active ? " (선택됨)" : ""}: 토큰이 아닌 색 ${fill}`);
      }
    }
  }
});

test("선택된 상태는 다른 색으로 나온다", () => {
  // 안 그러면 "내가 무엇을 골랐는지"를 판 테두리 하나에만 기대게 된다
  for (const choice of CHOICES) {
    assert.notEqual(render(choice, true), render(choice, false), `${choice}: 선택해도 그대로다`);
  }
});

test("그리드는 19×19 다 — 표시 크기 57·76 이 여기에 매여 있다", () => {
  for (const choice of CHOICES) {
    assert.ok(render(choice).includes('viewBox="0 0 19 19"'), `${choice}: viewBox 가 바뀌었다`);
  }
});
