'use client';
import {Literature} from './literature';
export function ResearchMap({initialMode='citations'}:{initialMode?:'citations'|'context'}){return <Literature initialMode={initialMode}/>;}
