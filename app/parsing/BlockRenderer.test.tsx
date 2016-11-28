/// <reference path="../../typings/expect/expect.d.ts" />
/// <reference path="../../typings/jasmine/jasmine.d.ts" />
/// <reference path="../../typings/custom/require.d.ts" />

import {Block} from './BlockList'
import {XMLRenderer} from './BlockRenderer'
import TestData from './TestData'

var expect: any = require('expect');
var cheerio: any = require('cheerio');

describe('XMLRenderer', () => {
  describe('toCombat', () => {
    it('renders', () => {
      var dummyWin: Block = {
        startLine: 0,
        indent: 0,
        render: cheerio.load('<div>win</div>')("div"),
        lines: [],
      };
      var dummyLose: Block = {
        startLine: 0,
        indent: 0,
        render: cheerio.load('<div>lose</div>')("div"),
        lines: [],
      };
      expect(XMLRenderer.toCombat(
        ["Enemy1", "Enemy2"],
        {win: [dummyWin], lose: [dummyLose]}).toString())
        .toEqual('<combat><e>Enemy1</e><e>Enemy2</e><event on="win"><div>win</div></event><event on="lose"><div>lose</div></event></combat>');
    });
  });

  describe('toTrigger', () => {
    it('renders', () => {
      expect(XMLRenderer.toTrigger("test").toString()).toEqual("<trigger>test</trigger>");
    });
  });

  describe('toQuest', () => {
    it('renders', () => {
      expect(XMLRenderer.toQuest("title", {'a': '1', 'b': '2'}).toString())
        .toEqual('<quest title="title" a="1" b="2"></quest>');
    });
  });

  describe('toRoleplay', () => {
    it('renders with title', () => {
      expect(XMLRenderer.toRoleplay({title: 'title'}, ['test1', 'test2']).toString())
        .toEqual('<roleplay title="title"><p>test1</p><p>test2</p></roleplay>');
    });

    it('renders without title', () => {
      expect(XMLRenderer.toRoleplay({}, []).toString())
        .toEqual('<roleplay></roleplay>');
    });

    it('renders with choice', () => {
      var choice: any = XMLRenderer.toRoleplay({}, ["choice body"]);

      expect(XMLRenderer.toRoleplay({}, [{text: 'choice', choice}]).toString())
        .toEqual('<roleplay><choice text="choice"><roleplay><p>choice body</p></roleplay></choice></roleplay>');
    });
  });

  describe('finalize', () => {
    it('coalesces all elements into first block', () => {
      var quest = XMLRenderer.toQuest("title", {});
      var r = XMLRenderer.toRoleplay({}, ['test']);
      var t = XMLRenderer.toTrigger("end");

      expect(XMLRenderer.finalize(quest, [r,t]).toString())
        .toEqual('<quest title="title"><roleplay><p>test</p></roleplay><trigger>end</trigger></quest>');
    })
  });
});
