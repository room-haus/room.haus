/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/label-has-for */
import React, {useState} from 'react';

export default ({audioParam}) => {
  const {name, value, maxValue, minValue, stepSize} = audioParam;
  const [stateValue, setStateValue] = useState(value);
  const updateParam = (e) => {
    audioParam.value = e.target.value;
    setStateValue(e.target.value);
  };
  return (
    <>
      <label htmlFor={name}>{name}</label>
      <input
        id={name}
        name={name}
        type="number"
        min={minValue}
        max={maxValue}
        step={stepSize}
        value={stateValue}
        onChange={updateParam}
      />
    </>
  );
};
