"use client";

import React from "react";
import * as SampleTypes from "../../../ADMINISTRATION/src/interfaces";
import { Sample } from "@/API";

const colorArray = [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "blue",
  "violet",
  "purple",
  "fuchsia",
  "indigo",
  
];
const getRandomColor = () => {
  return colorArray[Math.floor(Math.random() * colorArray.length)];
}
const SamplePropFieldSelect = ({
  fieldName,
  propName,
  fieldOBJ,
  updateFunc,
  value,
  sample
}: {
  fieldName: string;
  propName: string;
  fieldOBJ: object;
  updateFunc: any;
  value: any;
  sample:Sample
}) => {
  
  const color = getRandomColor();
  //console.log("color = ", color);
  //console.log("value = ", value);
  return (
    <div className="">
      <div className="flex md:gap-6">
        <label htmlFor="" className={`w-16 md:w-24 md:pl-6 font-normal text-center text-${color}-400`}>
          {fieldName}
        </label>
        <select
          //name={fieldName}
          //id={fieldName}
          title={fieldName}
    
          value={value}
          //defaultValue={value}
          className={`text-black w-12 md:w-24`}
          onChange={(e) => {
            updateFunc(e.target.value, propName,sample.id);
          }}
        >
          <option value="none">none</option>
          {Object.keys(fieldOBJ).sort().map((key) => {
            return <option  key={key}>{key}</option>;
          })}
        </select>
      </div>
    </div>
  );
};
export default function SampleProperties({
  sample,
  updateValue,
  
}: {
  sample: Sample;
  updateValue: any;
  
}) {
  //console.log("sample drum = ", sample?.drum!);
  const propertyTypes = [
    { name: "decade", prop: SampleTypes.DecadeStyle, key: "decadeStyle" },
    { name: "drum", prop: SampleTypes.Drum, key: "drum" },
    { name: "Genre", prop: SampleTypes.Genre, key: "genre" },
    { name: "Hygiene", prop: SampleTypes.Hygiene, key: "hygiene" },
    { name: "Length", prop: SampleTypes.Length, key: "length" },
    { name: "Loudness", prop: SampleTypes.Loudness, key: "loudness" },
    { name: "Mix", prop: SampleTypes.Mix, key: "mix" },
    { name: "Pitch Range", prop: SampleTypes.PitchRange, key: "pitchRange" },
    { name: "Source Gen 1", prop: SampleTypes.SourceGen1, key: "sourceGen1" },
    { name: "Source Gen 2", prop: SampleTypes.SourceGen2, key: "sourceGen2" },
    { name: "Drum Machine", prop: SampleTypes.DrumMachine, key: "drumMachine" },
  ];
  //console.log("sampleproperty = ", sample)
  
  return (
    <div className="text-xs flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
      <h1 className="font-extralight text-lime-400">edit sample properties</h1>
      <div className="flex flex-row flex-wrap gap-2 p-1 justify-center items-center w-full">
        {propertyTypes.map(({ name, prop, key }) => {
          let val = "none"
          try {
            val = sample[key as keyof Sample] as string;
          } catch (error) {
            val = "none"
          }
          if(!val) val = "none"
          
         //console.log("val = ", val);
          //const val = sample[key as keyof Sample];
          //console.log("sampleproperty = ", sample);
          return (
            <div key={key}>
              <SamplePropFieldSelect
                
                fieldName={name}
                propName={key}
                fieldOBJ={prop}
                updateFunc={updateValue}
                value={val}
                sample={sample}
              />
            </div>
          );
        })}
        <div className="flex gap-6">
          <label
            htmlFor="reversed"
            className="w-12 md:w-24 md:pl-6 text-center text-pink-300"
          >
            reversed
          </label>
          <input
          
            type="checkbox"
            title="reversed"
            name="reversed"
            id="reversed"
            className="w-10 md:w-24"
            onChange={(e) => updateValue(e.target.checked, "reversed",sample.id)}
          />
        </div>
        {/* <div className="flex gap-6">
          <label
            htmlFor="reversed"
            className="w-32 pl-6 text-center text-pink-300"
          >
            invalid
          </label>
          <input
            type="checkbox"
            title="reversed"
            name="reversed"
            id="reversed"
            className="w-24"
            onChange={(e) => updateValue(e.target.checked, "invalid")}
          />
        </div> */}
      </div>
    </div>
  );
}
