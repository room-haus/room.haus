import React from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {referenceProcessor} from '../shared/audio/research/reference.ts';
const configure=(research:ResearchAudio)=>{research.install('processor',referenceProcessor);research.update('processor',{cutoff:550});research.setLevel(.5);};
export default function AudioReference({onClose}:{onClose:()=>void}){
  return <ResearchHost title="Audio routing check" description="A development check for the shared audio path. Compare a deliberately muffled source, trigger one quiet hit, then return to Original." onClose={onClose} configure={configure} controls={({research,disabled})=><label>Reference low-pass (Hz)<input aria-label="Reference low-pass (Hz)" type="range" min="100" max="12000" step="50" defaultValue="550" disabled={disabled} onChange={event=>research.update('processor',{cutoff:Number(event.target.value)})}/></label>}/>;
}
