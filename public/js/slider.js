// const sliders = document.querySelectorAll(".item")

import { formatTimestamp } from "../../../js/formatDate.js"

const indicators = document.querySelector(".carousel-indicators")
const sliders = document.querySelector(".item:first-child")

const dateList = document.querySelectorAll(".articleDateContainer")

sliders.classList += ' active'


dateList.forEach(date=>{
    const inputValue = date.querySelector("input")
    const newDate = formatTimestamp(inputValue.value)
    date.innerText = newDate
})

