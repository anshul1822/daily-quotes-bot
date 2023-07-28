
const message = (user_name, quote, author) => {
     return `
Hi ${user_name}, Good Morning !!
    
Quote of the Day: 
${quote}
    
Author : ${author}
`;

}

module.exports = message;