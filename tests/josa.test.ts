import test from "node:test";
import assert from "node:assert/strict";
import { josa, withJosa } from "../src/shared/josa.ts";

test("josa: 받침 없는 이름", () => {
  assert.equal(josa("플레미", "은는"), "는");
  assert.equal(josa("아쿠비", "이가"), "가");
  assert.equal(josa("리피", "을를"), "를");
  assert.equal(josa("크리샤", "과와"), "와");
});

test("josa: 받침 있는 이름", () => {
  assert.equal(josa("모왕", "은는"), "은");
  assert.equal(josa("버노", "은는"), "는");   // ㅗ 로 끝난다
  assert.equal(josa("톡사룡", "이가"), "이");
  assert.equal(josa("오름", "을를"), "을");
});

test("josa: (으)로 는 ㄹ 받침을 따로 본다", () => {
  assert.equal(josa("모왕", "로"), "으로");
  assert.equal(josa("아쿠사", "로"), "로");
  assert.equal(josa("모왕이될뻔한물", "로"), "로");  // ㄹ 받침
});

test("josa: 숫자는 읽는 소리로 판정한다", () => {
  assert.equal(josa(3, "을를"), "을");      // 삼
  assert.equal(josa(278, "을를"), "을");    // 이백칠십팔
  assert.equal(josa(2, "을를"), "를");      // 이
  assert.equal(josa(100, "을를"), "을");    // 백 → 0 = 영
  assert.equal(josa(12, "로"), "로");       // 십이
  assert.equal(josa(21, "로"), "로");       // 스물하나 → 1 = ㄹ
  assert.equal(josa(13, "로"), "으로");     // 십삼
});

test("withJosa: 말과 조사를 붙인다", () => {
  assert.equal(withJosa("플레미", "은는"), "플레미는");
  assert.equal(withJosa("모왕", "이가"), "모왕이");
  assert.equal(withJosa(278, "을를"), "278을");
});
