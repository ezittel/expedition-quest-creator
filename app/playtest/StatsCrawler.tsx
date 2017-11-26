import {CrawlerBase, CrawlEvent, CrawlEntry} from 'expedition-qdl/lib/parse/Crawler'
import {Context} from 'expedition-qdl/lib/parse/Context'
import {Node} from 'expedition-qdl/lib/parse/Node'

function getWordCount(v: string): number {
    var matches = v.match(/\S+/g) ;
    return matches ? matches.length : 0;
}

export interface CrawlerStats {
  inputs: Set<string>;
  outputs: Set<string>;
  minPathActions: number;
  maxPathActions: number;
  numInternalStates: number;
}

export type StatsCrawlEntry = CrawlEntry<Context>;

export class StatsCrawler extends CrawlerBase<Context> {
  protected statsById: {[id:string]: CrawlerStats};
  protected statsByLine: {[line:number]: CrawlerStats};
  protected statsByEvent: {[event: string]: {lines: number[], ids: string[]}};
  protected minDepth: number;
  protected maxDepth: number;

  constructor() {
    super();

    // Initialize stats with a generic 'quest root'
    this.statsById = {
      'START': {inputs: new Set(), outputs: new Set(), minPathActions: -1, maxPathActions: -1, numInternalStates: -1}
    };
    this.statsByLine = {
      '-1': {inputs: new Set(), outputs: new Set(), minPathActions: -1, maxPathActions: -1, numInternalStates: -1}
    };
    this.statsByEvent = {
      'IMPLICIT_END': {lines: [], ids: []},
      'INVALID': {lines: [], ids: []},
      'END': {lines: [], ids: []},
      'MAX_DEPTH_EXCEEDED': {lines: [], ids: []},
      'ALREADY_SEEN': {lines: [], ids: []},
    };
    this.minDepth = null;
    this.maxDepth = null;
  }

  // Retrieves stats for a given node ID.
  // These aggregates treat all nodes following the ID node
  // as part of the ID node. For example, a graph like:
  //
  // <ID1> -> node1 -> node2 -> <ID2>
  //   '-> node3 -> <ID3>
  //
  // would be shortened to:
  //
  // <ID1> -> <ID2>
  //   '-> <ID3>
  public getStatsForId(id: string): CrawlerStats {
    return this.statsById[id];
  }

  // Gets statistics (including inbound and outbound actions)
  // for a block with a given line.
  public getStatsForLine(line: number): CrawlerStats {
    return this.statsByLine[line];
  }

  public getLines(): number[] {
    return Object.keys(this.statsByLine).filter((k: string) => {return (k !== '-1');}).map((s: string) => parseInt(s, 10));
  }

  public getIds(): string[] {
    return Object.keys(this.statsById).filter((k: string) => {return (k !== 'START');});
  }

  public getTimeRangeMinutes(): [number, number] {
    // TODO: Back-propagate and cache result
    return [this.minDepth, this.maxDepth];
  }

  protected calculateAddedDepth(n: Node<Context>): number {
    // Rules of thumb:
    // - combat nodes take ~5 minutes at minimum, ~15 minutes at maximum.
    // - "Audiobooks are recommended to be 150-160 words per minute..."
    //   https://en.wikipedia.org/wiki/Words_per_minute#Speech_and_listening
    // - Hick's Law describes time to make a choice as logarithmically related to the
    //   number of choices.
    //   https://en.wikipedia.org/wiki/Hick%27s_law

    switch (n.getTag()) {
      case 'combat':
        return 10;
      case 'roleplay':
        let wordCount = 0;
        n.loopChildren((tag: string, child: Cheerio)=> {
          wordCount += getWordCount(child.text().trim());
        });
        console.log('Added depth: ' + (0.05 + (wordCount / 150) + 1.0 * Math.log(n.getVisibleKeys().length + 1)));
        return 0.05 + (wordCount / 150) + 1.0 * Math.log(n.getVisibleKeys().length + 1);
      default:
        return 1;
    }
  }

  protected onEvent(q: StatsCrawlEntry, e: CrawlEvent) {
    if (e === 'MAX_DEPTH_EXCEEDED') {
      return;
    }
    this.statsById[q.prevId].outputs.add(e);
    this.statsByLine[q.prevLine].outputs.add(e);
    this.statsByEvent[e].lines.push(q.prevLine);
    this.statsByEvent[e].ids.push(q.prevId);

    if (e === 'END' || e === 'IMPLICIT_END' || e === 'MAX_DEPTH_EXCEEDED') {
      this.minDepth = (this.minDepth === null) ? q.depth : Math.min(this.minDepth, q.depth);
      this.maxDepth = (this.maxDepth === null) ? q.depth : Math.max(this.maxDepth, q.depth);
    }
  }

  protected onNode(q: StatsCrawlEntry, nodeStr: string, id: string, line: number): void {
    // Create stats for this line/id if they don't already exist
    if (this.statsById[id] === undefined) {
      this.statsById[id] = {
        inputs: new Set(),
        outputs: new Set(),
        minPathActions: this.statsById[q.prevId].minPathActions + 1,
        maxPathActions: this.statsById[q.prevId].maxPathActions + 1,
        numInternalStates: 1,
      };
    }
    if (this.statsByLine[line] === undefined) {
      this.statsByLine[line] = {
        inputs: new Set(),
        outputs: new Set(),
        minPathActions: this.statsByLine[q.prevLine].minPathActions + 1,
        maxPathActions: this.statsByLine[q.prevLine].maxPathActions + 1,
        numInternalStates: 0,
      };
    }

    // Fetch statistics
    let prevLineStats = this.statsByLine[q.prevLine];
    let lineStats = this.statsByLine[line];

    // Update ID statistics
    if (id !== q.prevId) {
      // We're in the boundary between ID sections. Update:
      // - outbound edges for the previous ID
      // - inbound edges for the next ID.
      // - path actions
      this.statsById[id].maxPathActions = Math.max(this.statsById[id].maxPathActions, (this.statsById[q.prevId].maxPathActions || 0) + 1);
      this.statsById[id].minPathActions = Math.min(this.statsById[id].minPathActions, (this.statsById[q.prevId].minPathActions || 0) + 1);
      this.statsById[id].inputs.add(q.prevId);
      this.statsById[q.prevId].outputs.add(id);
    } else {
      // We're still within the same ID. Increment numInternalStates.
      this.statsById[id].numInternalStates++;
    }

    // Update line stats for this line & prev line
    this.statsByLine[line].maxPathActions = Math.max(this.statsByLine[line].maxPathActions, (this.statsByLine[q.prevLine].maxPathActions || 0) + 1);
    this.statsByLine[line].minPathActions = Math.min(this.statsByLine[line].minPathActions, (this.statsByLine[q.prevLine].minPathActions || 0) + 1);
    lineStats.inputs.add(q.prevNodeStr);
    this.statsByLine[q.prevLine].outputs.add(nodeStr);
  }
}
