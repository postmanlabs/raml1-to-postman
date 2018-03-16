const ItemGroup = require('postman-collection').ItemGroup,
    Item = require('postman-collection').Item,
    Header = require('postman-collection').Header,
    Request = require('postman-collection').Request;


var helper = {

    convertHeader: function(header) {
        let converted_header = new Header();

        converted_header.key = header.name;
        header.description && converted_header.describe(header.description);

        return converted_header;
    },

    convertMethod: function(method) {
        let item = new Item(),
            request = new Request(),
            headerList;

        mediaType && request.headers.add(
            new Header({
                key: 'Content-Type',
                value: mediaType
            }));

        method.description && ( item.describe(method.description) );
        method.responses && ( item.responses.add(method.responses) );
        method.headers && ( headerList = new HeaderList() );

        for (header in method.headers) {
            request.headers.add(createHeader(method.headers[header]));
        }

        item.request = request;
        return item;
    },

    convertResources: function(res) {
        let folder = new ItemGroup();

        res.displayName && ( folder.name = res.displayName );
        //res.uriParameters && converturl()
        res.methods && res.methods.forEach( function (method) {
            helper.convertMethod(method);

        });
        collection.items.add(folder);
        res.resources && helper.convertResources(res.resources);

    }
};

module.exports = helper;
