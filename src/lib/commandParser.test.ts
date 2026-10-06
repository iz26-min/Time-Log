import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCommand } from "./commandParser";
import { hkLocalToDate } from "./time";

const ref = hkLocalToDate(2026, 10, 6, 10, 0, 0);

describe("parseCommand", () => {
  it("starts activity in English", () => {
    const r = parseCommand("Start breakfast", ref);
    assert.equal(r.intent, "START_ACTIVITY");
    if (r.intent === "START_ACTIVITY") {
      assert.equal(r.task, "breakfast");
    }
  });

  it("starts activity in Chinese", () => {
    const r = parseCommand("开始写 NSFC proposal", ref);
    assert.equal(r.intent, "START_ACTIVITY");
    if (r.intent === "START_ACTIVITY") {
      assert.equal(r.task, "写 NSFC proposal");
    }
  });

  it("finishes", () => {
    assert.equal(parseCommand("Finish", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("结束", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("结束 写作业", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("Finish homework", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("Finished homework", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("结束任务B", ref).intent, "END_ACTIVITY");
    assert.equal(parseCommand("开始任务A", ref).intent, "START_ACTIVITY");
  });

  it("starts at time English", () => {
    const r = parseCommand("Start reading at 3:20", ref);
    assert.equal(r.intent, "START_ACTIVITY");
    if (r.intent === "START_ACTIVITY") {
      assert.equal(r.task, "reading");
    }
  });

  it("starts at time Chinese", () => {
    const r = parseCommand("12:15开始午餐", ref);
    assert.equal(r.intent, "START_ACTIVITY");
    if (r.intent === "START_ACTIVITY") {
      assert.equal(r.task, "午餐");
    }
  });

  it("records complete English", () => {
    const r = parseCommand("Record lunch from 12:10 to 1:05", ref);
    assert.equal(r.intent, "ADD_COMPLETE_ACTIVITY");
  });

  it("records complete Chinese", () => {
    const r = parseCommand("记录 午餐 从 12:10 到 13:05", ref);
    assert.equal(r.intent, "ADD_COMPLETE_ACTIVITY");
    if (r.intent === "ADD_COMPLETE_ACTIVITY") {
      assert.equal(r.task, "午餐");
    }
  });
});
